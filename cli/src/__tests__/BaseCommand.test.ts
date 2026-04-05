import { BaseCommand, CommandMeta } from '../commands/base/BaseCommand';
import { GyoError } from '../core/index';

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn(),
  shouldStartLocalServer: jest.fn(),
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
    suggestNextSteps: jest.fn(),
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

import { logger } from '../utils/logger';
import { pathExists } from '../utils/fs';

const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;

class TestableBaseCommand extends BaseCommand {
  getMeta(): CommandMeta {
    return { name: 'test', description: 'test command' };
  }

  protected run(): Promise<void> {
    return Promise.resolve();
  }

  public testRun(): Promise<void> {
    return this.run();
  }

  public testLoadConfiguration(): Promise<void> {
    return this.loadConfiguration();
  }

  public testRequireGyoProject(): Promise<void> {
    return this.requireGyoProject();
  }

  public testHandleError(error: unknown): void {
    return this.handleError(error);
  }
}

describe('BaseCommand', () => {
  let command: TestableBaseCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableBaseCommand();
  });

  describe('constructor', () => {
    it('should initialize with empty options', () => {
      expect(command['options']).toEqual({});
    });

    it('should set config to null', () => {
      expect(command['config']).toBeNull();
    });
  });

  describe('setOptions', () => {
    it('should set options', () => {
      command.setOptions({ verbose: true });

      expect(logger.setVerbose).toHaveBeenCalledWith(true);
    });

    it('should not set verbose when not specified', () => {
      command.setOptions({});

      expect(logger.setVerbose).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should call run and succeed', async () => {
      const runSpy = jest.spyOn(command as any, 'run').mockResolvedValue(undefined);

      await command.execute();

      expect(runSpy).toHaveBeenCalled();
    });

    it('should throw GyoError when run rejects', async () => {
      jest.spyOn(command as any, 'run').mockRejectedValue(new Error('boom'));

      await expect(command.execute()).rejects.toThrow(GyoError);
    });
  });

  describe('requireGyoProject', () => {
    it('should throw GyoError when config file does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);

      await expect(command.testRequireGyoProject()).rejects.toThrow(GyoError);
      await expect(command.testRequireGyoProject()).rejects.toThrow('Not a gyo project');
    });

    it('should not throw when config file exists', async () => {
      mockedPathExists.mockResolvedValue(true);

      await expect(command.testRequireGyoProject()).resolves.toBeUndefined();
    });
  });

  describe('handleError', () => {
    it('should re-throw GyoError as-is', () => {
      const gyoError = new GyoError('custom error');

      expect(() => command.testHandleError(gyoError)).toThrow(gyoError);
    });

    it('should wrap generic Error in GyoError', () => {
      expect(() => command.testHandleError(new Error('generic'))).toThrow(GyoError);
    });

    it('should wrap non-Error in GyoError', () => {
      expect(() => command.testHandleError('string error')).toThrow(GyoError);
    });

    it('should log error message', () => {
      try {
        command.testHandleError(new Error('test msg'));
      } catch {
        // expected
      }

      expect(logger.error).toHaveBeenCalledWith('test msg');
    });

    it('should log stack in debug mode', () => {
      try {
        command.testHandleError(new Error('test msg'));
      } catch {
        // expected
      }

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('test msg'));
    });

    it('should preserve cause when wrapping Error', () => {
      const original = new Error('original');
      try {
        command.testHandleError(original);
      } catch (err) {
        expect((err as GyoError).cause).toBe(original);
      }
    });

    it('should preserve cause when wrapping non-Error', () => {
      try {
        command.testHandleError('string error');
      } catch (err) {
        expect((err as GyoError).cause).toBe('string error');
      }
    });
  });
});
