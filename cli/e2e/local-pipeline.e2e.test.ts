import * as path from 'path';
import fs from 'fs-extra';
import {
  execCLI,
  exec,
  createTempDir,
  cleanupDir,
  getAdbDeviceId,
  getIosDeviceId,
  getBridgePath,
  setSharedState,
  getSharedState,
} from './helpers';

const PROJECT_NAME = 'e2e-local-app';

beforeAll(async () => {
  console.log('[e2e:local] Building CLI...');
  const buildResult = await exec('npm run build', { cwd: path.resolve(__dirname, '..'), timeout: 60_000 });
  expect(buildResult.exitCode).toBe(0);

  const tempDir = await createTempDir('gyo-e2e-local-');
  const projectDir = path.join(tempDir, PROJECT_NAME);
  const androidDeviceId = await getAdbDeviceId();
  const iosDeviceId = await getIosDeviceId();

  setSharedState({ tempDir, projectDir, androidDeviceId, iosDeviceId });

  console.log(`[e2e:local] Temp dir: ${tempDir}`);
  console.log(`[e2e:local] Android device: ${androidDeviceId ?? 'not found'}`);
  console.log(`[e2e:local] iOS device: ${iosDeviceId ?? 'not found'}`);
}, 120_000);

afterAll(async () => {
  const state = getSharedState();
  console.log('[e2e:local] Cleaning up...');
  await cleanupDir(state.tempDir).catch(() => {});
}, 60_000);

describe('E2E Local: Project Creation & Build', () => {
  it('should create project with gyo create', async () => {
    const { tempDir } = getSharedState();
    const result = await execCLI(
      ['create', PROJECT_NAME, '--template', 'react'],
      { cwd: tempDir, timeout: 180_000 },
    );

    expect(result.exitCode).toBe(0);
    if (result.exitCode !== 0) {
      console.error(`[e2e:local] create failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    }
  }, 200_000);

  it('should have correct directory structure', async () => {
    const { projectDir } = getSharedState();
    const entries = await fs.readdir(projectDir);
    expect(entries).toContain('lib');
    expect(entries).toContain('android');
    expect(entries).toContain('ios');
    expect(entries).toContain('gyo.config.json');
    expect(entries).toContain('README.md');
    expect(entries).toContain('.gitignore');
  });

  it('should have valid gyo.config.json', async () => {
    const { projectDir } = getSharedState();
    const config = await fs.readJson(path.join(projectDir, 'gyo.config.json'));
    expect(config.name).toBe(PROJECT_NAME);
    expect(config.version).toBe('1.0.0');
    expect(config.profiles).toBeDefined();
    expect(config.profiles.development).toBeDefined();
    expect(config.profiles.production).toBeDefined();
    expect(config.script.start).toMatch(/npm run dev/);
  });

  it('should have replaced placeholders', async () => {
    const { projectDir } = getSharedState();
    const config = await fs.readJson(path.join(projectDir, 'gyo.config.json'));
    expect(config.platforms.android.packageName).toContain('com.example.');
    expect(config.platforms.ios.bundleId).toContain('com.example.');

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
    expect(xtoolYml).toContain('com.example.');
  });

  it('should have scaffolded React app in lib/', async () => {
    const { projectDir } = getSharedState();
    const pkgPath = path.join(projectDir, 'lib/package.json');
    expect(await fs.pathExists(pkgPath)).toBe(true);

    const pkg = await fs.readJson(pkgPath);
    expect(pkg.scripts.dev).toBeDefined();
  });

  it('should install dependencies and build lib/', async () => {
    const { projectDir } = getSharedState();
    const libPath = path.join(projectDir, 'lib');

    console.log('[e2e:local] Installing lib dependencies...');
    const installResult = await exec('npm install', { cwd: libPath, timeout: 120_000 });
    expect(installResult.exitCode).toBe(0);

    console.log('[e2e:local] Building lib...');
    const buildResult = await exec('npm run build', { cwd: libPath, timeout: 60_000 });
    expect(buildResult.exitCode).toBe(0);

    const distExists = await fs.pathExists(path.join(libPath, 'dist'));
    expect(distExists).toBe(true);
  }, 200_000);

  it('should install @gyo-framework/bridge from local path', async () => {
    const { projectDir } = getSharedState();
    const libPath = path.join(projectDir, 'lib');
    const bridgePath = getBridgePath();

    console.log(`[e2e:local] Installing bridge from: ${bridgePath}`);
    const result = await exec(`npm install "${bridgePath}"`, { cwd: libPath, timeout: 60_000 });
    expect(result.exitCode).toBe(0);

    const pkg = await fs.readJson(path.join(libPath, 'package.json'));
    expect(pkg.dependencies['@gyo-framework/bridge']).toBeDefined();
  }, 90_000);

  it('should create minimal Bridge example and build successfully', async () => {
    const { projectDir } = getSharedState();
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

    console.log('[e2e:local] Building lib with Bridge...');
    const buildResult = await exec('npm run build', { cwd: libPath, timeout: 60_000 });
    expect(buildResult.exitCode).toBe(0);

    const distExists = await fs.pathExists(path.join(libPath, 'dist'));
    expect(distExists).toBe(true);
    console.log('[e2e:local] Bridge build successful');
  }, 90_000);
});
