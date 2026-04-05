jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    setVerbose: jest.fn(),
    isVerbose: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn().mockResolvedValue(false),
  ensureDir: jest.fn(),
  copyDir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  removeDir: jest.fn(),
  getTemplatesPath: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  readJson: jest.fn().mockResolvedValue({ version: '0.1.0' }),
}));

import { UpgradeCommand } from '../commands/upgrade';
import { executeCommand } from '../utils/exec';
import { logger } from '../utils/logger';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;

function makeExecSuccess(stdout: string): ReturnType<typeof executeCommand> {
  return Promise.resolve({
    success: true,
    stdout,
    stderr: '',
    code: 0,
  });
}

describe('UpgradeCommand', () => {
  let command: UpgradeCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new UpgradeCommand();
  });

  it('should display version info and upgrade when newer available', async () => {
    mockedExec
      .mockResolvedValueOnce(makeExecSuccess('0.2.0\n'))
      .mockResolvedValueOnce(makeExecSuccess(''));

    command.setOptions({});
    await command['run']();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Current version'));
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Successfully upgraded'));
  });

  it('should say already up to date when versions match', async () => {
    mockedExec.mockResolvedValueOnce(makeExecSuccess('0.1.0\n'));

    command.setOptions({});
    await command['run']();

    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Already up to date'));
  });

  it('should check only without upgrading', async () => {
    mockedExec.mockResolvedValueOnce(makeExecSuccess('0.2.0\n'));

    command.setOptions({ check: true });
    await command['run']();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('new version is available'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('gyo upgrade'));
  });

  it('should report latest when check only and up to date', async () => {
    mockedExec.mockResolvedValueOnce(makeExecSuccess('0.1.0\n'));

    command.setOptions({ check: true });
    await command['run']();

    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('already on the latest'));
  });

  it('should throw when npm view fails', async () => {
    mockedExec.mockResolvedValueOnce({
      success: false,
      stdout: '',
      stderr: 'network error',
      code: 1,
    });

    command.setOptions({});

    await expect(command['run']()).rejects.toThrow();
  });

  it('should throw when upgrade install fails', async () => {
    mockedExec
      .mockResolvedValueOnce(makeExecSuccess('0.2.0\n'))
      .mockResolvedValueOnce({ success: false, stdout: '', stderr: 'perm', code: 1 });

    command.setOptions({});

    await expect(command['run']()).rejects.toThrow();
  });
});
