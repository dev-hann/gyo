import * as path from 'path';
import fs from 'fs-extra';
import {
  execCLI,
  exec,
  spawnCLI,
  createTempDir,
  cleanupDir,
  getAdbDeviceId,
  getIosDeviceId,
  uninstallAndroidApp,
  uninstallIosApp,
  waitForAndroidApp,
  waitForOutput,
  getBridgePath,
  stripAnsi,
} from './helpers';

const PROJECT_NAME = 'e2e-test-app';
const PACKAGE_NAME = 'com.example.e2e-test-app';
const BUNDLE_ID = 'com.example.e2e-test-app';

let tempDir: string;
let projectDir: string;
let androidDeviceId: string | null;
let iosDeviceId: string | null;

beforeAll(async () => {
  console.log('[e2e] Building CLI...');
  const buildResult = await exec('npm run build', { cwd: path.resolve(__dirname, '..'), timeout: 60_000 });
  expect(buildResult.exitCode).toBe(0);

  tempDir = await createTempDir();
  projectDir = path.join(tempDir, PROJECT_NAME);
  console.log(`[e2e] Temp dir: ${tempDir}`);

  androidDeviceId = await getAdbDeviceId();
  iosDeviceId = await getIosDeviceId();
  console.log(`[e2e] Android device: ${androidDeviceId ?? 'not found'}`);
  console.log(`[e2e] iOS device: ${iosDeviceId ?? 'not found'}`);
}, 120_000);

afterAll(async () => {
  console.log('[e2e] Cleaning up...');
  await uninstallAndroidApp(PACKAGE_NAME).catch(() => {});
  await uninstallIosApp(BUNDLE_ID).catch(() => {});
  await cleanupDir(tempDir).catch(() => {});
}, 60_000);

describe('E2E: Full Pipeline', () => {
  describe('Phase 1: Project Creation', () => {
    it('should create project with gyo create', async () => {
      const result = await execCLI(
        ['create', PROJECT_NAME, '--template', 'react'],
        { cwd: tempDir, timeout: 180_000 },
      );

      expect(result.exitCode).toBe(0);
      if (result.exitCode !== 0) {
        console.error(`[e2e] create failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
      }
    }, 200_000);

    it('should have correct directory structure', async () => {
      const entries = await fs.readdir(projectDir);
      expect(entries).toContain('lib');
      expect(entries).toContain('android');
      expect(entries).toContain('ios');
      expect(entries).toContain('gyo.config.json');
      expect(entries).toContain('README.md');
      expect(entries).toContain('.gitignore');
    });

    it('should have valid gyo.config.json', async () => {
      const config = await fs.readJson(path.join(projectDir, 'gyo.config.json'));
      expect(config.name).toBe(PROJECT_NAME);
      expect(config.version).toBe('1.0.0');
      expect(config.profiles).toBeDefined();
      expect(config.profiles.development).toBeDefined();
      expect(config.profiles.production).toBeDefined();
      expect(config.script.start).toMatch(/npm run dev/);
    });

    it('should have replaced placeholders', async () => {
      const config = await fs.readJson(path.join(projectDir, 'gyo.config.json'));
      expect(config.platforms.android.packageName).toBe(PACKAGE_NAME);
      expect(config.platforms.ios.bundleId).toBe(BUNDLE_ID);

      const androidManifest = await fs.readFile(
        path.join(projectDir, 'android/app/src/main/AndroidManifest.xml'),
        'utf-8',
      );
      expect(androidManifest).not.toContain('{{');

      const xtoolYml = await fs.readFile(
        path.join(projectDir, 'ios/xtool.yml'),
        'utf-8',
      );
      expect(xtoolYml).not.toContain('{{');
      expect(xtoolYml).toContain(BUNDLE_ID);
    });

    it('should have scaffolded React app in lib/', async () => {
      const pkgPath = path.join(projectDir, 'lib/package.json');
      expect(await fs.pathExists(pkgPath)).toBe(true);

      const pkg = await fs.readJson(pkgPath);
      expect(pkg.scripts.dev).toBeDefined();
    });

    it('should install dependencies and build lib/', async () => {
      const libPath = path.join(projectDir, 'lib');

      console.log('[e2e] Installing lib dependencies...');
      const installResult = await exec('npm install', { cwd: libPath, timeout: 120_000 });
      expect(installResult.exitCode).toBe(0);

      console.log('[e2e] Building lib...');
      const buildResult = await exec('npm run build', { cwd: libPath, timeout: 60_000 });
      expect(buildResult.exitCode).toBe(0);

      const distExists = await fs.pathExists(path.join(libPath, 'dist'));
      expect(distExists).toBe(true);
    }, 200_000);
  });

  describe('Phase 2: Android Build & Run', () => {
    let child: ReturnType<typeof spawnCLI>;

    beforeAll(async () => {
      if (!androidDeviceId) return;
      console.log('[e2e] Uninstalling previous Android app...');
      await uninstallAndroidApp(PACKAGE_NAME);
    });

    afterAll(async () => {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 3000));
        if (!child.killed) child.kill('SIGKILL');
      }
    });

    it('should build Android APK', async () => {
      if (!androidDeviceId) return;
      const result = await execCLI(
        ['build', 'android'],
        { cwd: projectDir, timeout: 300_000 },
      );

      expect(result.exitCode).toBe(0);
      console.log(`[e2e] build android stdout:\n${stripAnsi(result.stdout).slice(-500)}`);
    }, 300_000);

    it('should produce APK file', async () => {
      if (!androidDeviceId) return;
      const apkDir = path.join(projectDir, 'android/app/build/outputs/apk/debug');
      const exists = await fs.pathExists(apkDir);
      expect(exists).toBe(true);

      const files = await fs.readdir(apkDir);
      const apk = files.find((f) => f.endsWith('.apk'));
      expect(apk).toBeDefined();
    });

    it('should run on Android device and verify app is running', async () => {
      if (!androidDeviceId) return;

      child = spawnCLI(['run', '--device', androidDeviceId], { cwd: projectDir });

      await waitForOutput(child, /App installed/i, 180_000);
      console.log('[e2e] Android app installed, waiting for app to start...');

      const running = await waitForAndroidApp(PACKAGE_NAME, 30_000);
      expect(running).toBe(true);
      console.log('[e2e] Android app is running on device');
    }, 240_000);
  });

  describe('Phase 3: iOS Build & Run', () => {
    let child: ReturnType<typeof spawnCLI>;

    beforeAll(async () => {
      if (!iosDeviceId) return;
      console.log('[e2e] Uninstalling previous iOS app...');
      await uninstallIosApp(BUNDLE_ID);
    });

    afterAll(async () => {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 3000));
        if (!child.killed) child.kill('SIGKILL');
      }
    });

    it('should run on iOS device', async () => {
      if (!iosDeviceId) return;

      child = spawnCLI(['run', '--device', iosDeviceId], { cwd: projectDir });

      await waitForOutput(child, /App installed/i, 240_000);
      console.log('[e2e] iOS app installed successfully');
    }, 300_000);
  });

  describe('Phase 4: Bridge Integration', () => {
    it('should install @gyo-framework/bridge from local path', async () => {
      const libPath = path.join(projectDir, 'lib');
      const bridgePath = getBridgePath();

      console.log(`[e2e] Installing bridge from: ${bridgePath}`);
      const result = await exec(`npm install "${bridgePath}"`, { cwd: libPath, timeout: 60_000 });
      expect(result.exitCode).toBe(0);

      const pkg = await fs.readJson(path.join(libPath, 'package.json'));
      expect(pkg.dependencies['@gyo-framework/bridge']).toBeDefined();
    }, 90_000);

    it('should create minimal Bridge example and build successfully', async () => {
      const libPath = path.join(projectDir, 'lib');
      const appPath = path.join(libPath, 'src/App.tsx');

      const bridgeExample = `import { useState, useEffect } from 'react';
import { Bridge } from '@gyo-framework/bridge';

const bridge = new Bridge('e2e-test');

function App() {
  const [status, setStatus] = useState('Bridge init...');

  useEffect(() => {
    bridge.invoke('ping')
      .then(() => setStatus('Bridge OK'))
      .catch(() => setStatus('No native bridge (expected)'));
  }, []);

  return (
    <div>
      <h1>E2E Test App</h1>
      <p>{status}</p>
      <p>Bridge name: {bridge.getName()}</p>
    </div>
  );
}

export default App;
`;
      await fs.writeFile(appPath, bridgeExample);

      console.log('[e2e] Building lib with Bridge...');
      const buildResult = await exec('npm run build', { cwd: libPath, timeout: 60_000 });
      expect(buildResult.exitCode).toBe(0);

      const distExists = await fs.pathExists(path.join(libPath, 'dist'));
      expect(distExists).toBe(true);
      console.log('[e2e] Bridge build successful');
    }, 90_000);
  });
});
