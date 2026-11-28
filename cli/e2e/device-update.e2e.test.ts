import { execSync } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import fs from 'fs-extra';
import { exec, execCLI, createTempDir, cleanupDir, adbDeviceIds, stripAnsi } from './helpers';

// The native side of what an app that is not in a store needs to bring its
// own next version: the installed version (`@gyo-community/device-info`), a
// download to the cache with progress events (`@gyo-community/http`) and the
// package installer (`@gyo-community/app-launcher`). The progress is the
// first use of an event a handler publishes to the page, so this is also
// what proves the bridge carries it. It takes no internet: the page and the
// file come from a server of the test, and the file is the app's own APK.
// Installing is a permission from Android 8 on, which is what is checked.
const ROOT_DIR = path.resolve(__dirname, '../..');
const PROJECT_NAME = 'e2e-device-update';
// `gyo create` turns the hyphenated project name into a valid Android package.
const PACKAGE_NAME = 'com.example.e2e_device_update';
const BUILD_TIMEOUT_MS = 600_000;
const PLUGINS = ['app-launcher', 'device-info', 'http'];

// The page reports every result as `E2E-UPDATE <name> <json>`, which the
// WebView prints to logcat. Before an activity of the system opens it stops
// and asks `/continue`, and goes on once the test looked at that activity
// and came back.
const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>e2e update</title>
<script type="importmap">
  { "imports": {
      "@gyo-framework/bridge": "/vendor/bridge.js",
      "@gyo-community/app-launcher": "/vendor/app-launcher.js",
      "@gyo-community/device-info": "/vendor/device-info.js",
      "@gyo-community/http": "/vendor/http.js"
  } }
</script>
<script type="module">
  import { ApkInstaller } from '@gyo-community/app-launcher';
  import { PackageInfo } from '@gyo-community/device-info';
  import { Downloader, DownloadCancelledError } from '@gyo-community/http';

  const say = (name, value) => console.log('E2E-UPDATE ' + name + ' ' + JSON.stringify(value));
  const go = (step) => new Promise((resolve) => {
    const ask = () => fetch('/continue?after=' + step).then(
      (response) => (response.ok ? resolve() : setTimeout(ask, 300)),
      () => setTimeout(ask, 300)
    );
    ask();
  });

  const installer = new ApkInstaller();
  const downloader = new Downloader();
  say('available', {
    installer: installer.isAvailable(),
    downloader: downloader.isAvailable()
  });

  say('package', await new PackageInfo().getInfo());

  // The whole file, with every progress event the page was given.
  const events = [];
  const file = await downloader.download(
    { url: location.origin + '/e2e.apk', fileName: 'e2e.apk' },
    { onProgress: (progress) => events.push(progress) }
  ).result;
  say('downloaded', {
    path: file.path,
    status: file.status,
    bytesWritten: file.bytesWritten,
    events,
    neverBackwards: events.every((event, at) => at === 0 || event.bytesWritten >= events[at - 1].bytesWritten)
  });

  // A download cancelled once it started: it fails as cancelled, and keeps no file.
  const slow = downloader.download(
    { url: location.origin + '/slow.bin', fileName: 'slow.bin' },
    { onProgress: () => undefined }
  );
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  slow.cancel();
  let cancelled;
  try {
    await slow.result;
    cancelled = { cancelled: false };
  } catch (error) {
    cancelled = { cancelled: error instanceof DownloadCancelledError, name: error.name };
  }
  say('cancelled', cancelled);

  // A file the server does not have.
  let missing;
  try {
    await downloader.download({ url: location.origin + '/missing.bin' }).result;
    missing = { failed: false };
  } catch (error) {
    missing = { failed: true, message: error.message };
  }
  say('missing', missing);

  say('can install before', { canInstall: await installer.canInstall() });
  await go('grant');
  say('can install after', { canInstall: await installer.canInstall() });

  say('settings opened', { opened: await installer.openInstallSettings() });
  await go('settings');

  say('install', { started: await installer.install({ path: file.path }) });
  await go('installer');

  say('done', {});
</script>
`;

// Copies what the page needs next to it: itself, and the packages its import map names.
const LIB_BUILD = `import { copyFile, cp, mkdir } from 'node:fs/promises';

await mkdir('dist/vendor', { recursive: true });
await cp('public', 'dist', { recursive: true });
await copyFile('node_modules/@gyo-framework/bridge/dist/index.js', 'dist/vendor/bridge.js');
for (const name of ${JSON.stringify(PLUGINS)}) {
  await copyFile('node_modules/@gyo-community/' + name + '/dist/index.js', 'dist/vendor/' + name + '.js');
}
`;

/** A value read from the device while this file is being evaluated, where a skip is decided. */
function fromDevice(id: string, command: string): string {
  try {
    return execSync(`adb -s ${id} shell ${command}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    })
      .toString()
      .trim();
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

/** `it` here, where a device runs Android 8 or later; elsewhere a skip that says why. */
const itIfDevice: jest.It = itUnless(
  !device
    ? 'No Android device connected'
    : sdk < 26
      ? 'Needs Android 8, where installing an APK is a permission'
      : ''
);

/** Whether the device has the system's installer: an image made for tests only (ATD) has none. */
const hasInstaller = device
  ? !fromDevice(
      device,
      'cmd package resolve-activity -a android.intent.action.VIEW -d content://example/app.apk -t application/vnd.android.package-archive'
    ).includes('No activity found')
  : false;

/** `it` here, where the system can show its installer; elsewhere a skip that says why. */
const itIfInstaller: jest.It = itUnless(
  !device || sdk < 26
    ? 'Not on this device'
    : hasInstaller
      ? ''
      : 'The image has no package installer'
);

let tempDir: string;
let projectDir: string;
let server: http.Server;
let apk: Buffer;

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

/** Serves the built page, the app's own APK, a download that never ends, and answers the page when it may go on. */
function serve(directory: string, port: number): Promise<void> {
  server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/continue') {
      const go = url.searchParams.get('after') === released;
      if (go) released = '';
      response.writeHead(go ? 204 : 404).end();
      return;
    }
    if (url.pathname === '/e2e.apk') {
      // The size is said, as a release download says it: the page's progress has a total then.
      response
        .writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': apk.length,
        })
        .end(apk);
      return;
    }
    if (url.pathname === '/slow.bin') {
      // A kilobyte every 200 ms, for as long as the page cares: long enough to be cancelled.
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      const chunk = Buffer.alloc(1024, 1);
      const timer = setInterval(() => response.write(chunk), 200);
      response.on('close', () => clearInterval(timer));
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
          .writeHead(200, {
            'Content-Type': file.endsWith('.html')
              ? 'text/html; charset=utf-8'
              : file.endsWith('.js')
                ? 'text/javascript; charset=utf-8'
                : 'application/octet-stream',
          })
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
    const match = (await deviceLog()).match(new RegExp(`E2E-UPDATE ${name} (\\{.*\\})`));
    if (match) {
      return JSON.parse(match[1]) as Record<string, unknown>;
    }
    await settle(1_000);
  }
  throw new Error(
    `The page did not report "${name}" within ${timeoutMs}ms:\n${(await deviceLog()).slice(-2000)}`
  );
}

/** The activity in front, as `dumpsys activity activities` names it. */
async function topActivity(): Promise<string> {
  const result = await exec(
    `adb -s ${device} shell dumpsys activity activities | grep -E "topResumedActivity|ResumedActivity"`
  );
  return result.stdout;
}

/** The file in the cache of the app, as `ls` names it; empty when there is none. The app is a debug build, so `run-as` may look. */
async function cachedFile(name: string): Promise<string> {
  const listed = await exec(
    `adb -s ${device} shell run-as ${PACKAGE_NAME} ls -l cache/downloads/${name}`
  );
  return listed.exitCode === 0 ? listed.stdout : '';
}

/** Closes whatever a system screen put in front of the app, and only that: Back on the app itself would leave it. */
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

async function writeWebApp(libPath: string): Promise<void> {
  await fs.outputJson(path.join(libPath, 'package.json'), {
    name: 'e2e-lib',
    version: '1.0.0',
    private: true,
    scripts: { build: 'node build.mjs' },
  });
  await fs.outputFile(path.join(libPath, 'build.mjs'), LIB_BUILD);
  await fs.outputFile(path.join(libPath, 'public', 'index.html'), PAGE);

  // Installed the way npm link, pnpm and workspaces install: as symlinks.
  await fs.ensureDir(path.join(libPath, 'node_modules', '@gyo-community'));
  for (const name of PLUGINS) {
    await fs.symlink(
      path.join(ROOT_DIR, 'plugins', name),
      path.join(libPath, 'node_modules', '@gyo-community', name)
    );
  }
  await fs.ensureDir(path.join(libPath, 'node_modules', '@gyo-framework'));
  await fs.symlink(
    path.join(ROOT_DIR, 'bridge'),
    path.join(libPath, 'node_modules', '@gyo-framework', 'bridge')
  );
}

beforeAll(async () => {
  // Nothing to run: no device, or one whose Android has no permission to give.
  if (!device || sdk < 26) return;
  await exec(`adb -s ${device} uninstall ${PACKAGE_NAME} || true`);

  // The page imports the built packages.
  for (const directory of [
    path.join(ROOT_DIR, 'bridge'),
    ...PLUGINS.map((name) => path.join(ROOT_DIR, 'plugins', name)),
  ]) {
    const built = await exec('npm run build', { cwd: directory, timeout: 120_000 });
    expect(built.exitCode).toBe(0);
  }

  tempDir = await createTempDir('gyo-e2e-update-');
  projectDir = path.join(tempDir, PROJECT_NAME);
  console.log(`[e2e:update] Temp dir: ${tempDir}`);
  console.log(`[e2e:update] Device: ${device}`);

  const created = await execCLI(['create', PROJECT_NAME], { cwd: tempDir, timeout: 180_000 });
  expect(created.exitCode).toBe(0);

  await writeWebApp(path.join(projectDir, 'lib'));

  // What a real app does for the installer: the permission is the app's to declare.
  const manifestPath = path.join(projectDir, 'android/app/src/main/AndroidManifest.xml');
  const manifest = await fs.readFile(manifestPath, 'utf-8');
  expect(manifest).toContain('<uses-permission android:name="android.permission.INTERNET" />');
  await fs.writeFile(
    manifestPath,
    manifest.replace(
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.INTERNET" />\n' +
        '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
    )
  );

  // A device is given this machine's LAN address, which gyo finds for a localhost url.
  const port = await freePort();
  const address = `http://${emulator ? '10.0.2.2' : 'localhost'}:${port}`;
  const configured = await execCLI(['config', 'set', 'profiles.development.serverUrl', address], {
    cwd: projectDir,
  });
  expect(configured.exitCode).toBe(0);

  const built = await execCLI(['build', 'android'], { cwd: projectDir, timeout: BUILD_TIMEOUT_MS });
  if (built.exitCode !== 0) {
    console.log(stripAnsi(built.stdout).slice(-4000));
    console.log(built.stderr.slice(-2000));
  }
  expect(built.exitCode).toBe(0);

  apk = await fs.readFile(
    path.join(projectDir, 'android/app/build/outputs/apk/debug/app-debug.apk')
  );
  await serve(path.join(projectDir, 'lib', 'dist'), port);
}, BUILD_TIMEOUT_MS + 180_000);

afterAll(async () => {
  if (device) {
    await exec(`adb -s ${device} uninstall ${PACKAGE_NAME} || true`).catch(() => {});
  }
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDir) {
    await cleanupDir(tempDir);
  }
}, 60_000);

describe('E2E Device: the update of an app outside a store', () => {
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
      const started = await exec(
        `adb -s ${device} shell am start -n ${PACKAGE_NAME}/.MainActivity`
      );
      expect(started.exitCode).toBe(0);

      expect(await pageResult('available')).toEqual({ installer: true, downloader: true });
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should tell the installed app, as Android has it',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('package')).toEqual({
        packageName: PACKAGE_NAME,
        appName: PROJECT_NAME,
        versionName: '1.0.0',
        versionCode: 1,
      });
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should download the APK into the cache, telling the page how far it is',
    async () => {
      needsEarlierSteps();
      const downloaded = (await pageResult('downloaded')) as {
        path: string;
        status: number;
        bytesWritten: number;
        events: { bytesWritten: number; totalBytes: number }[];
        neverBackwards: boolean;
      };

      expect(downloaded.status).toBe(200);
      expect(downloaded.bytesWritten).toBe(apk.length);
      expect(downloaded.path).toBe(`/data/user/0/${PACKAGE_NAME}/cache/downloads/e2e.apk`);

      // The events reached the page through the bridge: one at the start, and a last one that says the file is whole.
      expect(downloaded.events.length).toBeGreaterThanOrEqual(2);
      expect(downloaded.events[0]).toEqual({ bytesWritten: 0, totalBytes: apk.length });
      expect(downloaded.events[downloaded.events.length - 1]).toEqual({
        bytesWritten: apk.length,
        totalBytes: apk.length,
      });
      expect(downloaded.neverBackwards).toBe(true);

      expect(await cachedFile('e2e.apk')).toContain(` ${apk.length} `);
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should fail a cancelled download as cancelled and keep no part of the file',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('cancelled')).toEqual({
        cancelled: true,
        name: 'DownloadCancelledError',
      });
      expect(await cachedFile('slow.bin')).toBe('');
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should fail a download the server answers with a 404',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('missing')).toEqual({
        failed: true,
        message: expect.stringMatching(
          /^The server answered 404 to http:\/\/(10\.0\.2\.2|localhost):\d+\/missing\.bin\.$/
        ),
      });
      stepPassed = true;
    },
    180_000
  );

  itIfDevice(
    'should refuse to install until the app is allowed to',
    async () => {
      needsEarlierSteps();
      // Android 8 and later: an app nothing allowed yet may not install, whatever its manifest says.
      expect(await pageResult('can install before')).toEqual({ canInstall: false });

      // What the reader does in the settings, done as a shell can.
      const allowed = await exec(
        `adb -s ${device} shell appops set ${PACKAGE_NAME} REQUEST_INSTALL_PACKAGES allow`
      );
      expect(allowed.exitCode).toBe(0);
      released = 'grant';

      expect(await pageResult('can install after')).toEqual({ canInstall: true });
      stepPassed = true;
    },
    180_000
  );

  itIfInstaller(
    'should open the settings where the app is allowed to install',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('settings opened')).toEqual({ opened: true });

      // A screen of the system's settings is in front, not the app.
      const deadline = Date.now() + 15_000;
      let top = '';
      while (Date.now() < deadline) {
        top = await topActivity();
        if (top && !top.includes(PACKAGE_NAME)) break;
        await settle(500);
      }
      expect(top).toMatch(/com\.android\.settings/);
      expect(top).not.toContain(PACKAGE_NAME);

      await backToApp();
      released = 'settings';
      stepPassed = true;
    },
    180_000
  );

  itIfInstaller(
    'should hand the downloaded APK to the package installer',
    async () => {
      needsEarlierSteps();
      expect(await pageResult('install')).toEqual({ started: true });

      // The installer of the system is in front, asked for an Android package.
      const started =
        /act=android\.intent\.action\.VIEW [^\n]*typ=application\/vnd\.android\.package-archive/;
      const deadline = Date.now() + 15_000;
      let log = '';
      let top = '';
      while (Date.now() < deadline) {
        log = await deviceLog();
        top = await topActivity();
        if (started.test(log) && top && !top.includes(PACKAGE_NAME)) break;
        await settle(500);
      }
      expect(log).toMatch(started);
      expect(top).not.toContain(PACKAGE_NAME);

      // The installer is left without installing: the app of the test stays what it is.
      await backToApp();
      released = 'installer';
      expect(await pageResult('done')).toEqual({});
      stepPassed = true;
    },
    180_000
  );
});
