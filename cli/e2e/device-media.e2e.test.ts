import { execSync } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import fs from 'fs-extra';
import { exec, execCLI, createTempDir, cleanupDir, adbDeviceIds, stripAnsi } from './helpers';

// The only test that runs a plugin's native side on a device. The Android
// suite compiles every plugin; this one has @gyo-community/media write to the
// media store and open the share sheet. It takes no internet: the page and
// the image come from a server of the test. Saving without asking for a
// permission is what is checked, so the device has to run Android 10 or later.
const ROOT_DIR = path.resolve(__dirname, '../..');
const PROJECT_NAME = 'e2e-device-media';
// `gyo create` turns the hyphenated project name into a valid Android package.
const PACKAGE_NAME = 'com.example.e2e_device_media';
const BUILD_TIMEOUT_MS = 600_000;

// A 1x1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64').length;

// The page reports every result as `E2E-MEDIA <name> <json>`, which the
// WebView prints to logcat. After a share it stops and asks `/continue`
// until the test lets it go on: a share fired while the chooser is open is
// merged into it, and the page cannot see when the chooser closes.
const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>e2e media</title>
<script type="importmap">
  { "imports": {
      "@gyo-framework/bridge": "/vendor/bridge.js",
      "@gyo-community/media": "/vendor/media.js"
  } }
</script>
<script type="module">
  import { Media } from '@gyo-community/media';

  const media = new Media();
  const image = location.origin + '/e2e-media.png';
  const say = (name, value) => console.log('E2E-MEDIA ' + name + ' ' + JSON.stringify(value));
  const go = (step) => new Promise((resolve) => {
    const ask = () => fetch('/continue?after=' + step).then(
      (response) => (response.ok ? resolve() : setTimeout(ask, 300)),
      () => setTimeout(ask, 300)
    );
    ask();
  });

  say('available', { available: media.isAvailable() });
  say('saved', await media.saveToGallery({ url: image, folder: 'E2e Media' }));
  say('unreachable', await media.saveToGallery({ url: 'http://10.0.2.2:9/unreachable.png' }));

  say('shared text', await media.share({ text: 'Shared by the gyo e2e test' }));
  await go('text');
  say('shared image', await media.share({ url: image }));
  await go('image');

  const five = await Promise.all(
    [1, 2, 3, 4, 5].map(() => media.saveToGallery({ url: image, filename: 'at-once.png' }))
  );
  say('parallel', {
    statuses: five.map((result) => result.status),
    uris: five.map((result) => result.uri ?? null)
  });
  say('done', {});
</script>
`;

// Copies what the page needs next to it: itself, and the two packages its import map names.
const LIB_BUILD = `import { copyFile, cp, mkdir } from 'node:fs/promises';

await mkdir('dist/vendor', { recursive: true });
await cp('public', 'dist', { recursive: true });
await copyFile('node_modules/@gyo-framework/bridge/dist/index.js', 'dist/vendor/bridge.js');
await copyFile('node_modules/@gyo-community/media/dist/index.js', 'dist/vendor/media.js');
`;

/** A value read from the device while this file is being evaluated, where a skip is decided. */
function fromDevice(id: string, command: string): string {
  try {
    return execSync(`adb -s ${id} shell ${command}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    }).toString().trim();
  } catch {
    return '';
  }
}

// An emulator comes first: it reaches this machine as 10.0.2.2, and the test does not install on a phone.
const device = adbDeviceIds()[0];
const emulator = device?.startsWith('emulator-') ?? false;
const sdk = device ? Number(fromDevice(device, 'getprop ro.build.version.sdk')) : 0;

/** `it`, or a variant that skips with the reason folded into the test name. */
function itUnless(reason: string): jest.It {
  if (!reason) return it;
  return ((name: string, fn?: jest.ProvidesCallback, timeout?: number) =>
    it.skip(`${name} — ${reason}`, fn, timeout)) as unknown as jest.It;
}

/** `it` here, where a device runs Android 10 or later; elsewhere a skip that says why. */
const itIfDevice: jest.It = itUnless(
  !device
    ? 'No Android device connected'
    : sdk < 29
      ? 'Needs Android 10, where saving takes no permission'
      : ''
);

let tempDir: string;
let projectDir: string;
let server: http.Server;

/** The step the page may go on from. It is taken by the first request that asks for it. */
let released = '';

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port nothing listens on. */
async function freePort(): Promise<number> {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, resolve));
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/** Serves the built page, and answers the page when it may go on. */
function serve(directory: string, port: number): Promise<void> {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
  };
  server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/continue') {
      const go = url.searchParams.get('after') === released;
      if (go) released = '';
      response.writeHead(go ? 204 : 404).end();
      return;
    }
    const file = path.join(directory, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(directory)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file).then(
      (body) => {
        response
          .writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
          .end(body);
      },
      () => response.writeHead(404).end()
    );
  });
  return new Promise((resolve) => server.listen(port, '0.0.0.0', resolve));
}

/** What the device printed for the page and for the activities it started. */
async function deviceLog(): Promise<string> {
  const result = await exec(
    `adb -s ${device} logcat -d -v brief -s WebView-Console:I ActivityTaskManager:I`
  );
  return result.stdout;
}

/** What the page reported for `name`, once it has. */
async function pageResult(name: string, timeoutMs = 60_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = (await deviceLog()).match(new RegExp(`E2E-MEDIA ${name} (\\{.*\\})`));
    if (match) {
      return JSON.parse(match[1]) as Record<string, unknown>;
    }
    await settle(1_000);
  }
  throw new Error(`The page did not report "${name}" within ${timeoutMs}ms:\n${(await deviceLog()).slice(-2000)}`);
}

/** The activity in front, as `dumpsys activity activities` names it. */
async function topActivity(): Promise<string> {
  const result = await exec(
    `adb -s ${device} shell dumpsys activity activities | grep -E "topResumedActivity|ResumedActivity"`
  );
  return result.stdout;
}

/**
 * Waits for the evidence of a share. The system logged the start of the
 * chooser, and either the sheet is in front of the app, or it launched its
 * one target at once, which the START of the send names with the type. On a
 * device where that target leaves again at once, nothing stays in front.
 */
async function shareOpened(mimeType: string, timeoutMs = 15_000): Promise<string> {
  const pattern = new RegExp(`act=android\\.intent\\.action\\.SEND typ=${mimeType.replace('/', '\\/')}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const log = await deviceLog();
    const inFront = await topActivity();
    if (
      /act=android\.intent\.action\.CHOOSER /.test(log) &&
      (pattern.test(log) || (inFront && !inFront.includes(PACKAGE_NAME)))
    ) {
      return log;
    }
    await settle(500);
  }
  throw new Error(`No chooser was started for a ${mimeType}:\n${await deviceLog()}`);
}

/** Closes whatever a share put in front of the app, and only that: Back on the app itself would leave it. */
async function backToApp(): Promise<void> {
  for (let press = 0; press < 4; press++) {
    const top = await topActivity();
    if (top.includes(PACKAGE_NAME)) return;
    // Nothing named: not a moment to press blind.
    if (top === '') break;
    await exec(`adb -s ${device} shell input keyevent KEYCODE_BACK`);
    await settle(1_500);
  }
  expect(await topActivity()).toContain(PACKAGE_NAME);
}

/** The row of the media store behind the uri: the name, the folder, the size and the type.
 * `content` takes a projection of colon-separated columns; asked for every column, it stops part-way through a row. */
async function mediaRow(uri: string): Promise<string> {
  const result = await exec(
    `adb -s ${device} shell content query --uri ${uri} --projection _display_name:relative_path:_size:mime_type`
  );
  return result.stdout;
}

/**
 * Deletes the images a run saved. Uninstalling the app does not: a file it
 * stored in the media store stays, and is the user's from then on.
 *
 * The rows are found by listing the collection rather than with a `--where`
 * clause: that clause has to pass two shells, and one that lost its quotes
 * makes `content` print its usage and still exit with 0.
 */
async function forgetSavedImages(): Promise<void> {
  const listed = await exec(
    `adb -s ${device} shell content query --uri content://media/external/images/media --projection _id:_display_name`
  );
  const ids = [...listed.stdout.matchAll(/_id=(\d+), _display_name=(?:e2e-media|at-once)/g)].map(
    (match) => match[1]
  );
  for (const id of ids) {
    const deleted = await exec(
      `adb -s ${device} shell content delete --uri content://media/external/images/media/${id}`
    );
    expect(deleted.exitCode).toBe(0);
    expect(deleted.stdout.trim()).toBe('');
  }
}

async function writeWebApp(libPath: string): Promise<void> {
  await fs.outputJson(path.join(libPath, 'package.json'), {
    name: 'e2e-lib',
    version: '1.0.0',
    private: true,
    scripts: { build: 'node build.mjs' },
  });
  await fs.outputFile(path.join(libPath, 'build.mjs'), LIB_BUILD);
  await fs.outputFile(path.join(libPath, 'public', 'index.html'), PAGE);
  await fs.outputFile(
    path.join(libPath, 'public', 'e2e-media.png'),
    Buffer.from(PNG_BASE64, 'base64')
  );

  // Installed the way npm link, pnpm and workspaces install: as symlinks.
  await fs.ensureDir(path.join(libPath, 'node_modules', '@gyo-community'));
  await fs.symlink(
    path.join(ROOT_DIR, 'plugins', 'media'),
    path.join(libPath, 'node_modules', '@gyo-community', 'media')
  );
  await fs.ensureDir(path.join(libPath, 'node_modules', '@gyo-framework'));
  await fs.symlink(
    path.join(ROOT_DIR, 'bridge'),
    path.join(libPath, 'node_modules', '@gyo-framework', 'bridge')
  );
}

beforeAll(async () => {
  // Nothing to run: no device, or one whose Android cannot skip the permission.
  if (!device || sdk < 29) return;
  await forgetSavedImages();

  // The page imports the built packages.
  for (const directory of [path.join(ROOT_DIR, 'bridge'), path.join(ROOT_DIR, 'plugins', 'media')]) {
    const built = await exec('npm run build', { cwd: directory, timeout: 120_000 });
    expect(built.exitCode).toBe(0);
  }

  tempDir = await createTempDir('gyo-e2e-media-');
  projectDir = path.join(tempDir, PROJECT_NAME);
  console.log(`[e2e:media] Temp dir: ${tempDir}`);
  console.log(`[e2e:media] Device: ${device}`);

  const created = await execCLI(['create', PROJECT_NAME], { cwd: tempDir, timeout: 180_000 });
  expect(created.exitCode).toBe(0);

  await writeWebApp(path.join(projectDir, 'lib'));

  // A device is given this machine's LAN address, which gyo finds for a localhost url.
  const port = await freePort();
  const address = `http://${emulator ? '10.0.2.2' : 'localhost'}:${port}`;
  const configured = await execCLI(
    ['config', 'set', 'profiles.development.serverUrl', address],
    { cwd: projectDir }
  );
  expect(configured.exitCode).toBe(0);

  const built = await execCLI(['build', 'android'], { cwd: projectDir, timeout: BUILD_TIMEOUT_MS });
  if (built.exitCode !== 0) {
    console.log(stripAnsi(built.stdout).slice(-4000));
    console.log(built.stderr.slice(-2000));
  }
  expect(built.exitCode).toBe(0);

  await serve(path.join(projectDir, 'lib', 'dist'), port);
}, BUILD_TIMEOUT_MS + 180_000);

afterAll(async () => {
  if (device) {
    await exec(`adb -s ${device} uninstall ${PACKAGE_NAME} || true`).catch(() => {});
    await forgetSavedImages().catch(() => {});
  }
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDir) {
    await cleanupDir(tempDir);
  }
}, 60_000);

describe('E2E Device: @gyo-community/media', () => {
  // Every step needs the one before it on the device: after a failure the
  // rest would only wait for what is not coming.
  let failedAt = '';
  let stepPassed = false;

  afterEach(() => {
    if (!stepPassed && !failedAt) {
      failedAt = String(expect.getState().currentTestName);
    }
    stepPassed = false;
  });

  const needsEarlierSteps = () => {
    if (failedAt) {
      throw new Error(`Not run: "${failedAt}" failed first.`);
    }
  };

  itIfDevice(
    'should install the app and load the page',
    async () => {
      needsEarlierSteps();
      const installed = await exec(
        `adb -s ${device} install -r ${projectDir}/android/app/build/outputs/apk/debug/app-debug.apk`,
        { timeout: 120_000 }
      );
      expect(installed.exitCode).toBe(0);

      await exec(`adb -s ${device} logcat -c`);
      const started = await exec(`adb -s ${device} shell am start -n ${PACKAGE_NAME}/.MainActivity`);
      expect(started.exitCode).toBe(0);

      expect(await pageResult('available')).toEqual({ available: true });
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should save the image to Pictures and answer an unreachable address with a network failure',
    async () => {
      needsEarlierSteps();
      const saved = await pageResult('saved');
      expect(saved).toEqual({ status: 'saved', uri: expect.any(String), mimeType: 'image/png' });

      // The name is exact: an image of an earlier run still there would have made it "e2e-media (2).png".

      const row = await mediaRow(saved.uri as string);
      expect(row).toContain('_display_name=e2e-media.png');
      expect(row).toContain('relative_path=Pictures/E2e Media/');
      expect(row).toContain(`_size=${PNG_BYTES}`);
      expect(row).toContain('mime_type=image/png');

      expect(await pageResult('unreachable')).toMatchObject({
        status: 'failed',
        error: { kind: 'network', message: expect.stringContaining('unreachable.png') },
      });
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should open the system chooser for a text',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('shared text')).toEqual({ status: 'shared' });

      // A text is carried as an extra, which the START of the chooser does not show.
      const log = await shareOpened('text/plain');
      expect(log).toMatch(/act=android\.intent\.action\.CHOOSER /);
      await backToApp();
      released = 'text';
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should open the system chooser for the image',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('shared image')).toEqual({ status: 'shared' });

      // A file is carried as a clip, which the START of the chooser shows with its type.
      expect(await shareOpened('image/png')).toMatch(
        /act=android\.intent\.action\.CHOOSER [^\n]*clip=\{image\/png/
      );
      await backToApp();
      released = 'image';
      stepPassed = true;
    },
    180_000
  );

  // Saves asked for at once each end in a row of their own. The handler
  // takes the media store one save at a time for that, after the store had
  // answered two pending files of one name with one row. That race is a
  // matter of timing, and five at once do not bring it back: this step is
  // not what proves the lock.
  itIfDevice(
    'should save five files of one name asked for at once',
    async () => {
      needsEarlierSteps();
      const parallel = (await pageResult('parallel')) as { statuses: string[]; uris: string[] };
      expect(parallel.statuses).toEqual(['saved', 'saved', 'saved', 'saved', 'saved']);
      expect(new Set(parallel.uris).size).toBe(5);

      // Every uri is a row of its own, with the file in it.
      for (const uri of parallel.uris) {
        const row = await mediaRow(uri);
        expect(row).toContain('_display_name=at-once');
        expect(row).toContain(`_size=${PNG_BYTES}`);
      }

      expect(await pageResult('done')).toEqual({});
      stepPassed = true;
    },
    180_000
  );
});
