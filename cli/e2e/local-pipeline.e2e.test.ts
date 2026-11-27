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
  const buildResult = await exec('npm run build', {
    cwd: path.resolve(__dirname, '..'),
    timeout: 60_000,
  });
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
    const result = await execCLI(['create', PROJECT_NAME], { cwd: tempDir, timeout: 60_000 });

    expect(result.exitCode).toBe(0);
    if (result.exitCode !== 0) {
      console.error(
        `[e2e:local] create failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
    }
  }, 90_000);

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

  it('should not ship Gradle cache directories from the template', async () => {
    const { projectDir } = getSharedState();

    expect(await fs.pathExists(path.join(projectDir, 'android/.gradle'))).toBe(false);
  });

  it('should let debug builds load the dev server over plain http', async () => {
    const { projectDir } = getSharedState();
    const debugConfig = await fs.readFile(
      path.join(projectDir, 'android/app/src/debug/res/xml/network_security_config.xml'),
      'utf-8'
    );

    expect(debugConfig).toContain('cleartextTrafficPermitted="true"');
  });

  it('should have valid gyo.config.json', async () => {
    const { projectDir } = getSharedState();
    const config = await fs.readJson(path.join(projectDir, 'gyo.config.json'));
    expect(config.name).toBe(PROJECT_NAME);
    expect(config.version).toBe('1.0.0');
    expect(config.profiles).toBeDefined();
    expect(config.profiles.development).toBeDefined();
    expect(config.profiles.development.serverUrl).toMatch(/^https?:\/\//);
    expect(config.script.start).toMatch(/npm run dev/);
  });

  it('should have the launcher label in the string resource', async () => {
    const { projectDir } = getSharedState();
    const manifest = await fs.readFile(
      path.join(projectDir, 'android/app/src/main/AndroidManifest.xml'),
      'utf-8'
    );
    const strings = await fs.readFile(
      path.join(projectDir, 'android/app/src/main/res/values/strings.xml'),
      'utf-8'
    );

    expect(manifest).toContain('android:label="@string/app_name"');
    expect(strings).toContain(`<string name="app_name">${PROJECT_NAME}</string>`);
  });

  it('should ignore generated files and secrets in .gitignore', async () => {
    const { projectDir } = getSharedState();
    const gitignore = await fs.readFile(path.join(projectDir, '.gitignore'), 'utf-8');

    for (const rule of [
      'android/app/src/main/assets/gyo-config.json',
      'android/keystore.properties',
      '*.jks',
      '*.keystore',
    ]) {
      expect(gitignore).toContain(rule);
    }
  });

  it('should have replaced placeholders', async () => {
    const { projectDir } = getSharedState();
    const config = await fs.readJson(path.join(projectDir, 'gyo.config.json'));
    expect(config.platforms.android.packageName).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    expect(config.platforms.ios.bundleId).toContain('com.example.');

    const androidManifest = await fs.readFile(
      path.join(projectDir, 'android/app/src/main/AndroidManifest.xml'),
      'utf-8'
    );
    expect(androidManifest).not.toContain('{{');

    const xtoolYml = await fs.readFile(path.join(projectDir, 'ios/xtool.yml'), 'utf-8');
    expect(xtoolYml).not.toContain('{{');
    expect(xtoolYml).toContain('com.example.');
  });

  it('should scaffold a web app in lib/ as the user would', async () => {
    const { projectDir } = getSharedState();
    const libPath = path.join(projectDir, 'lib');

    // gyo is framework-agnostic: the user brings their own web app.
    // Simulate a user scaffolding a minimal TypeScript web app in lib/.
    await fs.writeJson(path.join(libPath, 'package.json'), {
      name: 'e2e-lib',
      version: '1.0.0',
      scripts: {
        dev: 'npx --yes serve src -l 3000 --no-clipboard',
        build: 'tsc -p tsconfig.json',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    });

    await fs.writeJson(path.join(libPath, 'tsconfig.json'), {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        outDir: 'dist',
        rootDir: 'src',
        strict: true,
        skipLibCheck: true,
        lib: ['ES2020', 'DOM'],
      },
      include: ['src/**/*.ts'],
    });

    await fs.ensureDir(path.join(libPath, 'src'));
    await fs.writeFile(
      path.join(libPath, 'src/main.ts'),
      'console.log("hello from lib");\nexport {};\n'
    );

    const pkg = await fs.readJson(path.join(libPath, 'package.json'));
    expect(pkg.scripts.build).toBeDefined();
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
    const mainPath = path.join(libPath, 'src/main.ts');

    const bridgeExample = `import { Bridge } from '@gyo-framework/bridge';

const bridge = new Bridge('e2e-test');

bridge.invoke('ping').catch(() => {
  // No native bridge in a plain browser context (expected)
});

console.log('Bridge name:', bridge.getName());
`;
    await fs.writeFile(mainPath, bridgeExample);

    console.log('[e2e:local] Building lib with Bridge...');
    const buildResult = await exec('npm run build', { cwd: libPath, timeout: 60_000 });
    expect(buildResult.exitCode).toBe(0);

    const distExists = await fs.pathExists(path.join(libPath, 'dist'));
    expect(distExists).toBe(true);
    console.log('[e2e:local] Bridge build successful');
  }, 90_000);
});

// These commands went through the unit tests untouched while the bundle was
// broken: the unit tests run as CommonJS and mock the file system.
describe('E2E Local: commands on the built bundle', () => {
  function occurrences(text: string, part: string): number {
    return text.split(part).length - 1;
  }

  it('should print the version of the installed CLI', async () => {
    const cliPackage = await fs.readJson(path.resolve(__dirname, '../package.json'));

    const result = await execCLI(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(cliPackage.version);
  });

  it('should keep a string a string in gyo config set', async () => {
    const { projectDir } = getSharedState();

    const result = await execCLI(['config', 'set', 'version', '2'], { cwd: projectDir });

    expect(result.exitCode).toBe(0);
    expect((await fs.readJson(path.join(projectDir, 'gyo.config.json'))).version).toBe('2');
  });

  it('should refuse an invalid value once and leave the config alone', async () => {
    const { projectDir } = getSharedState();

    const result = await execCLI(['config', 'set', 'displayName', ''], { cwd: projectDir });

    expect(result.exitCode).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(occurrences(output, "'displayName' must be a non-empty string")).toBe(1);
    expect(output).not.toContain('Command failed');
    expect(await fs.readJson(path.join(projectDir, 'gyo.config.json'))).not.toHaveProperty(
      'displayName'
    );
  });

  it('should report an invalid platform once', async () => {
    const { projectDir } = getSharedState();

    const result = await execCLI(['build', 'windows'], { cwd: projectDir });

    expect(result.exitCode).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output.match(/Invalid platform: windows/g)).toHaveLength(1);
  });
});
