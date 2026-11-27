import fs from 'fs-extra';
import { BuildCommand } from '../commands/build';
import { WebServerService } from '../services/web-server.service';
import { checkCommandExists, executeCommand, requireTool } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));
// ESM-only
jest.mock('inquirer', () => ({ prompt: jest.fn(), default: { prompt: jest.fn() } }));
jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
  getGradlew: jest.requireActual('../utils/exec').getGradlew,
}));

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;

const SIGNING_ENV = [
  'GYO_ANDROID_KEYSTORE_PATH',
  'GYO_ANDROID_KEYSTORE_PASSWORD',
  'GYO_ANDROID_KEY_ALIAS',
  'GYO_ANDROID_KEY_PASSWORD',
] as const;

// `gyo build <platform>` hands the platform, the profile and `--release` to
// the command that builds it. What reached that command shows in what it
// then did: the Gradle task, the file it wrote.
describe('BuildCommand', () => {
  let project: TestProject;
  const signing = SIGNING_ENV.map((name) => process.env[name]);

  function build(platform: string, options: { release?: boolean } = {}): Promise<void> {
    const command = new BuildCommand();
    command.setPositionalArgs([platform]);
    command.setOptions({ profile: 'production', release: options.release ?? false });
    return command.execute();
  }

  /** Every command the CLI ran, in order. */
  function ran(): string[] {
    return mockedExec.mock.calls.map(([command, args]) => `${command} ${(args ?? []).join(' ')}`);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    silenceLogger();
    project = await createTestProject();
    await project.setConfig({
      profiles: {
        production: { serverUrl: 'https://example.com' },
        development: { serverUrl: 'http://localhost:3000' },
      },
    });

    mockedExec.mockResolvedValue({ success: true, stdout: '', stderr: '', code: 0 });
    mockedCheck.mockResolvedValue(true);
    mockedRequireTool.mockResolvedValue(undefined);
    jest
      .spyOn(WebServerService.prototype, 'resolveServerUrl')
      .mockResolvedValue('http://192.168.1.5:3000');
  });

  afterEach(() => {
    SIGNING_ENV.forEach((name, index) => {
      if (signing[index] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = signing[index];
      }
    });
    project.remove();
    jest.restoreAllMocks();
  });

  it('should hand android and the profile to the Android command', async () => {
    await build('android');

    expect(ran()).toEqual(['./gradlew assembleDebug']);
    expect(
      fs.readJsonSync(project.file('android/app/src/main/assets/gyo-config.json'))
    ).toMatchObject({
      serverUrl: 'https://example.com',
    });
  });

  it('should hand --release to the Android command', async () => {
    // A release build is signed from the environment before Gradle runs.
    fs.writeFileSync(project.android('app/release.keystore'), '');
    process.env.GYO_ANDROID_KEYSTORE_PATH = 'release.keystore';
    process.env.GYO_ANDROID_KEYSTORE_PASSWORD = 'store-secret';
    process.env.GYO_ANDROID_KEY_ALIAS = 'release';
    process.env.GYO_ANDROID_KEY_PASSWORD = 'key-secret';

    await build('android', { release: true });

    expect(ran()).toEqual(['./gradlew assembleRelease']);
  });

  it('should hand ios and the profile to the iOS command', async () => {
    mockedExec.mockImplementation((command: string) =>
      Promise.resolve(
        command === 'idevice_id'
          ? { success: true, stdout: 'abc123', stderr: '', code: 0 }
          : { success: true, stdout: '', stderr: '', code: 0 }
      )
    );

    await build('ios');

    expect(mockedExec).toHaveBeenCalledWith('xtool', ['dev'], {
      cwd: project.ios(),
      stdio: 'pipe',
    });
    expect(fs.readJsonSync(project.file('ios/Sources/Resources/gyo-config.json'))).toMatchObject({
      serverUrl: 'https://example.com',
    });
  });

  it('should hand --release to the iOS command, which refuses it', async () => {
    await expect(build('ios', { release: true })).rejects.toThrow(
      '--release is not supported for iOS'
    );

    expect(ran()).toEqual([]);
  });

  it('should report a failure of the platform command, and its error once', async () => {
    mockedExec.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: 'FAILURE: Build failed',
      code: 1,
    });

    await expect(build('android')).rejects.toThrow('Android build failed');

    // Gradle's output, then the error: never the same error twice.
    expect(logger.error).toHaveBeenCalledWith('FAILURE: Build failed');
    expect(
      jest.mocked(logger.error).mock.calls.filter(([message]) => message === 'Android build failed')
    ).toHaveLength(1);
  });

  it('should refuse a platform it cannot build, naming the ones it can', async () => {
    await expect(build('windows')).rejects.toThrow(
      'Invalid platform: windows. Valid platforms are: android, ios'
    );

    expect(ran()).toEqual([]);
  });
});
