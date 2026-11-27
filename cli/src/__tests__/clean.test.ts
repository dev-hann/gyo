import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { CleanCommand } from '../commands/clean';
import { executeCommand } from '../utils/exec';
import { logger } from '../utils/logger';

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
  },
}));

// Only Gradle is mocked: what a clean does is remove directories.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn().mockResolvedValue({ success: true, stdout: '', stderr: '', code: 0 }),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
}));

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;

// A project with build output in all three places a clean removes.
const BUILD_OUTPUT = [
  'android/app/build/keep.txt',
  'ios/.build/keep.txt',
  'lib/dist/keep.txt',
  'lib/node_modules/some-package/keep.txt',
];

describe('CleanCommand', () => {
  let projectPath: string;
  let previousCwd: string;

  const exists = (relativePath: string): boolean =>
    fs.pathExistsSync(path.join(projectPath, relativePath));

  function clean(...args: string[]): Promise<void> {
    const command = new CleanCommand();
    command.setPositionalArgs(args);
    return command.execute();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-clean-'));
    previousCwd = process.cwd();
    process.chdir(projectPath);

    for (const file of BUILD_OUTPUT) {
      fs.outputFileSync(path.join(projectPath, file), '');
    }
  });

  afterEach(() => {
    // A test may have made directories read-only to force a failure.
    for (const dir of ['ios', 'lib']) {
      fs.chmodSync(path.join(projectPath, dir), 0o700);
    }
    process.chdir(previousCwd);
    fs.removeSync(projectPath);
  });

  it('should remove the build output of every platform', async () => {
    await clean();

    for (const file of BUILD_OUTPUT) {
      expect(exists(path.dirname(file))).toBe(false);
    }
    expect(logger.success).toHaveBeenCalledWith('iOS .build cleaned');
    expect(logger.success).toHaveBeenCalledWith('Lib node_modules cleaned');
  });

  it('should remove only the platform asked for', async () => {
    await clean('ios');

    expect(exists('ios/.build')).toBe(false);
    expect(exists('android/app/build')).toBe(true);
    expect(exists('lib/dist')).toBe(true);
  });

  it('should skip a platform the project does not have', async () => {
    fs.removeSync(path.join(projectPath, 'android'));

    await expect(clean('android')).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith('Android project not found, skipping');
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it('should ask Gradle to clean the Android project', async () => {
    await clean('android');

    expect(mockedExec).toHaveBeenCalledWith('./gradlew', ['clean'], {
      cwd: path.join(projectPath, 'android'),
      stdio: 'pipe',
    });
    expect(exists('android/app/build')).toBe(false);
    expect(exists('ios/.build')).toBe(true);
  });

  it('should fail the clean when Gradle fails', async () => {
    mockedExec.mockResolvedValueOnce({ success: false, stdout: '', stderr: 'no Java', code: 1 });

    await expect(clean('android')).rejects.toThrow('gradle clean');
    expect(logger.warn).toHaveBeenCalledWith('Android clean failed');
  });

  it('should try every platform and then report what it could not remove', async () => {
    // Read-only parents make removing what is inside them fail.
    fs.chmodSync(path.join(projectPath, 'ios'), 0o500);
    fs.chmodSync(path.join(projectPath, 'lib'), 0o500);

    await expect(clean()).rejects.toThrow('Could not clean');

    expect(exists('android/app/build')).toBe(false);
    expect(exists('ios/.build')).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to remove'));
  });

  it('should refuse a platform it cannot clean, naming the ones it can', async () => {
    await expect(clean('windows')).rejects.toThrow(
      'Invalid platform: windows. Valid platforms are: android, ios, lib'
    );
  });
});
