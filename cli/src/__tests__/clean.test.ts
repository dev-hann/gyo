jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
}));

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn().mockResolvedValue(false),
  ensureDir: jest.fn(),
  copyDir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  removeDir: jest.fn().mockResolvedValue(undefined),
  getTemplatesPath: jest.fn(),
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

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn(),
  shouldStartLocalServer: jest.fn(),
}));

import { CleanCommand } from '../commands/clean';
import { executeCommand, getGradlew } from '../utils/exec';
import { pathExists, removeDir } from '../utils/fs';
import { logger } from '../utils/logger';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedRemoveDir = removeDir as jest.MockedFunction<typeof removeDir>;

describe('CleanCommand', () => {
  let command: CleanCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new CleanCommand();
  });

  describe('cleanAndroid', () => {
    it('should skip when android directory does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);
      command.setPlatform('android');

      await command['run']();

      expect(mockedExec).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should run gradlew clean and remove build dir', async () => {
      mockedPathExists.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('android')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      mockedExec.mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        code: 0,
      });
      command.setPlatform('android');

      await command['run']();

      expect(getGradlew).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Android'));
    });

    it('should warn on gradle failure', async () => {
      mockedPathExists.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('android')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      mockedExec.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'build error',
        code: 1,
      });
      command.setPlatform('android');

      await command['run']();

      expect(logger.warn).toHaveBeenCalledWith('Android clean failed');
    });
  });

  describe('cleanIOS', () => {
    it('should skip when ios directory does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);
      command.setPlatform('ios');

      await command['run']();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should remove build and Pods directories', async () => {
      mockedPathExists.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('ios')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      command.setPlatform('ios');

      await command['run']();

      expect(mockedRemoveDir).toHaveBeenCalled();
    });
  });

  describe('cleanLib', () => {
    it('should skip when lib directory does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);
      command.setPlatform('lib');

      await command['run']();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should remove dist and node_modules', async () => {
      mockedPathExists.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('lib')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      command.setPlatform('lib');

      await command['run']();

      expect(mockedRemoveDir).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('node_modules'));
      expect(logger.success).toHaveBeenCalledWith('Lib build cleaned');
    });
  });

  describe('cleanAll', () => {
    it('should process all platforms', async () => {
      mockedPathExists.mockResolvedValue(false);
      command.setPlatform('all');

      await command['run']();

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('cleanAndroid removeDir failure', () => {
    it('should warn when removeDir fails after successful gradle clean', async () => {
      mockedPathExists.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('android')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      mockedExec.mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        code: 0,
      });
      mockedRemoveDir.mockRejectedValue(new Error('permission denied'));
      command.setPlatform('android');

      await command['run']();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to remove'));
    });
  });

  describe('run error handling', () => {
    it('should wrap non-GyoError in GyoError when clean throws', async () => {
      mockedPathExists.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('ios')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      mockedRemoveDir.mockRejectedValue(new Error('disk error'));
      command.setPlatform('ios');

      const GyoError = jest.requireActual('../core/errors').GyoError;
      let thrownError: unknown;
      try {
        await command['run']();
      } catch (error) {
        thrownError = error;
      }
      expect(thrownError).toBeInstanceOf(GyoError);
      expect((thrownError as Error).message).toContain('disk error');
    });
  });
});
