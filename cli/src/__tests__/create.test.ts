import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { CreateCommand } from '../commands/create';
import { validateConfig } from '../services/config.service';
import { logger } from '../utils/logger';

// `utils/paths` reads import.meta.url, which Jest's CommonJS transform
// cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setVerbose: jest.fn(),
    suggestNextSteps: jest.fn(),
  },
}));

// Run against the real templates in a real directory: what `gyo create`
// does is copy and render them.
describe('CreateCommand', () => {
  let workDir: string;
  let previousCwd: string;
  let previousAndroidHome: string | undefined;

  const projectPath = (name = 'my-app'): string => path.join(workDir, name);
  const read = (file: string): string => fs.readFileSync(path.join(workDir, file), 'utf-8');

  function create(name: string, options: { force?: boolean } = {}): Promise<void> {
    const command = new CreateCommand();
    command.setPositionalArgs([name]);
    command.setOptions(options);
    return command.execute();
  }

  /** Every text file under the project, with its path relative to it. */
  async function textFiles(
    dir: string,
    prefix = ''
  ): Promise<Array<{ file: string; content: string }>> {
    const files: Array<{ file: string; content: string }> = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const relativePath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await textFiles(path.join(dir, entry.name), relativePath)));
      } else if (!entry.name.endsWith('.jar')) {
        files.push({
          file: relativePath,
          content: fs.readFileSync(path.join(dir, entry.name), 'utf-8'),
        });
      }
    }
    return files;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-create-'));
    previousCwd = process.cwd();
    previousAndroidHome = process.env.ANDROID_HOME;
    process.chdir(workDir);
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
  });

  afterEach(() => {
    process.chdir(previousCwd);
    if (previousAndroidHome === undefined) {
      delete process.env.ANDROID_HOME;
    } else {
      process.env.ANDROID_HOME = previousAndroidHome;
    }
    fs.removeSync(workDir);
  });

  it('should scaffold both shells around an empty lib/', async () => {
    await create('my-app');

    const entries = (await fs.readdir(projectPath())).sort();
    expect(entries).toEqual([
      '.gitignore',
      'README.md',
      'android',
      'gyo.config.json',
      'ios',
      'lib',
    ]);
    expect(await fs.readdir(path.join(projectPath(), 'lib'))).toEqual([]);
    expect(logger.suggestNextSteps).toHaveBeenCalledWith([
      'cd my-app',
      'Create your web app in lib/ (any framework)',
      'Set script.start in gyo.config.json',
      'gyo run          # Run on connected device',
    ]);
  });

  it('should write a valid config that names the project', async () => {
    await create('my-app');

    const config = await fs.readJson(path.join(projectPath(), 'gyo.config.json'));
    expect(validateConfig(config)).toBe(true);
    expect(config).toMatchObject({
      name: 'my-app',
      version: '1.0.0',
      profiles: { development: { serverUrl: 'http://localhost:3000' } },
      script: { start: 'npm run dev' },
    });
    expect(config.platforms.android.packageName).toBe('com.example.my_app');
    // The bundle ID of the iOS app lives in ios/xtool.yml; the config names none.
    expect(config.platforms.ios).toEqual({ enabled: true });
  });

  it('should leave no placeholder behind', async () => {
    await create('my-app');

    const unreplaced = (await textFiles(projectPath())).filter(({ content }) =>
      content.includes('{{')
    );
    expect(unreplaced.map(({ file }) => file)).toEqual([]);
  });

  it('should put MainActivity.kt where its package path says', async () => {
    await create('my-app');

    const activity = read('my-app/android/app/src/main/java/com/example/my_app/MainActivity.kt');
    expect(activity).toContain('package com.example.my_app');
    expect(fs.pathExistsSync(path.join(projectPath(), 'android/app/src/main/kotlin'))).toBe(false);
  });

  it('should write the README of the project', async () => {
    await create('my-app');

    const readme = read('my-app/README.md');
    expect(readme).toContain('# my-app');
    expect(readme).toContain('├── android/');
    // The add-on features of the framework live under the community scope.
    expect(readme).toContain('npm install @gyo-community/http');
    expect(readme).not.toContain('{{');
  });

  it('should ignore what gyo generates and what has to stay secret', async () => {
    await create('my-app');

    const gitignore = read('my-app/.gitignore');
    for (const rule of [
      'android/app/src/main/assets/gyo-config.json',
      'ios/Sources/Resources/gyo-config.json',
      'android/keystore.properties',
      '*.jks',
      '*.keystore',
      '.gyo-plugins',
      'local.properties',
    ]) {
      expect(gitignore).toContain(rule);
    }
  });

  it('should point Gradle at the SDK that ANDROID_HOME names', async () => {
    const sdk = path.join(workDir, 'sdk');
    fs.ensureDirSync(sdk);
    process.env.ANDROID_HOME = sdk;

    await create('my-app');

    expect(read('my-app/android/local.properties')).toBe(`sdk.dir=${sdk}\n`);
  });

  it('should go on without an SDK and say so', async () => {
    await create('my-app');

    expect(fs.pathExistsSync(path.join(projectPath(), 'android/local.properties'))).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'Android SDK not found. Set ANDROID_HOME or install Android Studio.'
    );
  });

  it('should refuse to overwrite a project without --force', async () => {
    await create('my-app');

    await expect(create('my-app')).rejects.toThrow('Directory "my-app" already exists');
    expect(fs.pathExistsSync(path.join(projectPath(), 'README.md'))).toBe(true);
  });

  it('should replace a project with --force', async () => {
    await create('my-app');
    fs.writeFileSync(path.join(projectPath(), 'stray.txt'), '');

    await create('my-app', { force: true });

    expect(fs.pathExistsSync(path.join(projectPath(), 'stray.txt'))).toBe(false);
    expect(fs.pathExistsSync(path.join(projectPath(), 'README.md'))).toBe(true);
  });

  // Each with the reason it is refused: a wrong reason is a wrong check.
  it.each([
    ['', 'Project name cannot be empty'],
    ['   ', 'Project name cannot be empty'],
    ['my app', 'must contain only lowercase letters, numbers, hyphens'],
    ['MyApp', 'must contain only lowercase letters, numbers, hyphens'],
    ['-my-app', 'must contain only lowercase letters, numbers, hyphens'],
    ['my@app', 'must contain only lowercase letters, numbers, hyphens'],
    ['evil/path', 'cannot contain path separators'],
    ['evil\\path', 'cannot contain path separators'],
    ['..', 'cannot contain path separators'],
  ])('should refuse the project name "%s"', async (name, reason) => {
    await expect(create(name)).rejects.toThrow(reason);

    expect((await fs.readdir(workDir)).filter((entry) => !entry.startsWith('sdk'))).toEqual([]);
  });
});
