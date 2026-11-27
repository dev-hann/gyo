import * as path from 'path';
import fs from 'fs-extra';
import { execCLI, exec, createTempDir, cleanupDir, itIfAndroidSdk, stripAnsi } from './helpers';

// The unit tests mock the file system and nothing else compiles Kotlin: this
// is the only place where the generated Android project is built with every
// official plugin in it. It found four compile errors in plugins that had
// never been compiled.
const ROOT_DIR = path.resolve(__dirname, '../..');
const PROJECT_NAME = 'e2e-android-app';
const GRADLE_TIMEOUT_MS = 600_000;

interface LocalPlugin {
  name: string;
  dir: string;
}

/** Every package under plugins/ that brings an Android module. */
async function localPlugins(): Promise<LocalPlugin[]> {
  const pluginsDir = path.join(ROOT_DIR, 'plugins');
  const plugins: LocalPlugin[] = [];

  for (const entry of await fs.readdir(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(pluginsDir, entry.name);
    const pkgJsonPath = path.join(dir, 'package.json');
    if (!(await fs.pathExists(pkgJsonPath))) continue;

    const pkgJson = await fs.readJson(pkgJsonPath);
    if (pkgJson.gyo?.android) {
      plugins.push({ name: pkgJson.name as string, dir });
    }
  }

  return plugins.sort((a, b) => a.name.localeCompare(b.name));
}

let tempDir: string;
let projectDir: string;
let plugins: LocalPlugin[];

beforeAll(async () => {
  plugins = await localPlugins();
  tempDir = await createTempDir('gyo-e2e-android-');
  projectDir = path.join(tempDir, PROJECT_NAME);
  console.log(`[e2e:android] Temp dir: ${tempDir}`);

  const created = await execCLI(['create', PROJECT_NAME], { cwd: tempDir });
  expect(created.exitCode).toBe(0);

  // Installed the way npm link, pnpm and workspaces install: as symlinks.
  for (const plugin of plugins) {
    const [, name] = plugin.name.split('/');
    const link = path.join(projectDir, 'lib', 'node_modules', '@gyo-framework', name);
    await fs.ensureDir(path.dirname(link));
    await fs.symlink(plugin.dir, link);
  }

  const installed = await execCLI(['install'], { cwd: projectDir });
  console.log(stripAnsi(installed.stdout));
  expect(installed.exitCode).toBe(0);
}, 120_000);

afterAll(async () => {
  await cleanupDir(tempDir);
}, 60_000);

describe('E2E Android: plugins as Gradle modules', () => {
  it('should include every official plugin as a module', async () => {
    const settings = await fs.readFile(
      path.join(projectDir, 'android', 'gyo.settings.gradle'),
      'utf-8'
    );

    expect(plugins.length).toBeGreaterThan(0);
    for (const { name } of plugins) {
      expect(settings).toContain(`projectDir = file('`);
      expect(settings).toMatch(new RegExp(`^include ':gyo-plugin-${name.split('/')[1]}'$`, 'm'));
    }
  });

  itIfAndroidSdk()(
    'should build the app with every official plugin in it',
    async () => {
      const result = await exec('./gradlew :app:assembleDebug --no-daemon --console=plain', {
        cwd: path.join(projectDir, 'android'),
        timeout: GRADLE_TIMEOUT_MS,
      });

      if (result.exitCode !== 0) {
        console.log(result.stdout.slice(-6000));
        console.log(result.stderr.slice(-2000));
      }

      expect(result.exitCode).toBe(0);
      expect(
        await fs.pathExists(
          path.join(projectDir, 'android', 'app/build/outputs/apk/debug/app-debug.apk')
        )
      ).toBe(true);
    },
    GRADLE_TIMEOUT_MS + 120_000
  );
});
