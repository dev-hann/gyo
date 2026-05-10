import * as path from 'path';
import fs from 'fs-extra';
import {
  execCLI,
  exec,
  createTempDir,
  cleanupDir,
  getAdbDeviceId,
  getIosDeviceId,
  uninstallAndroidApp,
  uninstallIosApp,
  waitForAndroidApp,
  setSharedState,
  getSharedState,
  itIfAndroid,
  itIfIOS,
  stripAnsi,
} from './helpers';

const PROJECT_NAME = 'e2e-device-app';
const PACKAGE_NAME = 'com.example.e2edeviceapp';
const BUNDLE_ID = 'com.example.e2edeviceapp';

beforeAll(async () => {
  console.log('[e2e:device] Building CLI...');
  const buildResult = await exec('npm run build', { cwd: path.resolve(__dirname, '..'), timeout: 60_000 });
  expect(buildResult.exitCode).toBe(0);

  const tempDir = await createTempDir('gyo-e2e-device-');
  const projectDir = path.join(tempDir, PROJECT_NAME);
  const androidDeviceId = await getAdbDeviceId();
  const iosDeviceId = await getIosDeviceId();

  setSharedState({ tempDir, projectDir, androidDeviceId, iosDeviceId });

  console.log(`[e2e:device] Temp dir: ${tempDir}`);
  console.log(`[e2e:device] Android device: ${androidDeviceId ?? 'not found'}`);
  console.log(`[e2e:device] iOS device: ${iosDeviceId ?? 'not found'}`);

  if (androidDeviceId || iosDeviceId) {
    console.log('[e2e:device] Creating project...');
    const result = await execCLI(
      ['create', PROJECT_NAME, '--template', 'react'],
      { cwd: tempDir, timeout: 180_000 },
    );
    expect(result.exitCode).toBe(0);

    const libPath = path.join(projectDir, 'lib');
    console.log('[e2e:device] Installing lib dependencies...');
    await exec('npm install', { cwd: libPath, timeout: 120_000 });
    console.log('[e2e:device] Building lib...');
    await exec('npm run build', { cwd: libPath, timeout: 60_000 });
  }
}, 300_000);

afterAll(async () => {
  const state = getSharedState();
  console.log('[e2e:device] Cleaning up...');
  await uninstallAndroidApp(PACKAGE_NAME).catch(() => {});
  await uninstallIosApp(BUNDLE_ID).catch(() => {});
  await cleanupDir(state.tempDir).catch(() => {});
}, 60_000);

describe('E2E Device: Android Build & Run', () => {
  beforeAll(async () => {
    const state = getSharedState();
    if (!state.androidDeviceId) return;
    console.log('[e2e:device] Uninstalling previous Android app...');
    await uninstallAndroidApp(PACKAGE_NAME);
  });

  itIfAndroid()('should build Android APK', async () => {
    const { projectDir } = getSharedState();
    const result = await execCLI(
      ['build', 'android'],
      { cwd: projectDir, timeout: 300_000 },
    );

    expect(result.exitCode).toBe(0);
    console.log(`[e2e:device] build android stdout:\n${stripAnsi(result.stdout).slice(-500)}`);
  }, 300_000);

  itIfAndroid()('should produce APK file', async () => {
    const { projectDir } = getSharedState();
    const apkDir = path.join(projectDir, 'android/app/build/outputs/apk/debug');
    const exists = await fs.pathExists(apkDir);
    expect(exists).toBe(true);

    const files = await fs.readdir(apkDir);
    const apk = files.find((f) => f.endsWith('.apk'));
    expect(apk).toBeDefined();
  });

  itIfAndroid()('should install APK on device', async () => {
    const { projectDir, androidDeviceId } = getSharedState();
    const result = await exec(
      `adb -s ${androidDeviceId} install -r ${projectDir}/android/app/build/outputs/apk/debug/app-debug.apk`,
      { timeout: 60_000 },
    );
    expect(result.exitCode).toBe(0);
    console.log('[e2e:device] APK installed on Android device');
  }, 90_000);

  itIfAndroid()('should launch app and verify it is running', async () => {
    const { androidDeviceId } = getSharedState();
    const result = await exec(
      `adb -s ${androidDeviceId} shell am start -n ${PACKAGE_NAME}/.MainActivity`,
    );
    expect(result.exitCode).toBe(0);

    const running = await waitForAndroidApp(PACKAGE_NAME, 15_000);
    expect(running).toBe(true);
    console.log('[e2e:device] Android app is running on device');
  }, 30_000);
});

describe('E2E Device: iOS Build & Run', () => {
  itIfIOS()('should build and install iOS app via xtool dev', async () => {
    const { projectDir } = getSharedState();
    const iosPath = path.join(projectDir, 'ios');
    const result = await exec('xtool dev', { cwd: iosPath, timeout: 240_000 });

    if (result.exitCode !== 0) {
      console.log(`[e2e:device] iOS build failed:\n${result.stderr.slice(-500)}`);
    }

    expect(result.exitCode).toBe(0);
    console.log('[e2e:device] iOS app built and installed');
  }, 300_000);
});
