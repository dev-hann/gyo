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
    verbose: jest.fn(),
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

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue(null),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn(),
  shouldStartLocalServer: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeJson: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
}));

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import { AndroidRunCommand } from '../commands/run/AndroidRunCommand';
import { executeCommand, checkCommandExists } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { BuildFailedError } from '../core/errors';
import { spawn } from 'child_process';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedFsReadFile = fs.readFile as unknown as jest.Mock;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

function makeExecResult(success: boolean, stdout = '', stderr = '') {
  return Promise.resolve({ success, stdout, stderr, code: success ? 0 : 1 });
}

describe('AndroidRunCommand', () => {
  let command: AndroidRunCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new AndroidRunCommand();
    (command as any).options = { profile: 'development', device: 'emulator-5554' };
    (command as any).projectPath = '/project';
  });

  afterEach(() => {
    if (mockedSpawn.mock.calls.length > 0) {
      mockedSpawn.mock.calls.forEach(([, , options]) => {
        if (options && typeof options === 'object') {
          mockedSpawn.mockClear();
        }
      });
    }
  });

  describe('checkAdbAvailable', () => {
    it('should pass when adb exists', async () => {
      mockedCheck.mockResolvedValue(true);

      await expect(command['checkAdbAvailable']()).resolves.toBeUndefined();
    });

    it('should throw ToolRequiredError when adb not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await expect(command['checkAdbAvailable']()).rejects.toThrow('Required tool');
    });
  });

  describe('buildApp', () => {
    it('should succeed on successful build', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true));

      await expect(command['buildApp']('/android')).resolves.toBeUndefined();
    });

    it('should throw BuildFailedError on build failure', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'BUILD FAILED'));

      await expect(command['buildApp']('/android')).rejects.toThrow(BuildFailedError);
    });

    it('should log SDK hint when build fails with SDK location not found', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'SDK location not found'));

      await expect(command['buildApp']('/android')).rejects.toThrow(BuildFailedError);

      const { logger } = jest.requireMock('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ANDROID_HOME'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('gyo doctor'));
    });
  });

  describe('installApp', () => {
    it('should succeed on successful install', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true));

      await expect(command['installApp']('/android')).resolves.toBeUndefined();
    });

    it('should throw BuildFailedError on install failure', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'INSTALL FAILED'));

      await expect(command['installApp']('/android')).rejects.toThrow(BuildFailedError);
    });
  });

  describe('getConnectedDevice', () => {
    it('should return device from options', async () => {
      const device = await command['getConnectedDevice']();
      expect(device).toBe('emulator-5554');
    });

    it('should return empty string when no device specified', async () => {
      (command as any).options = { profile: 'development' };

      const device = await command['getConnectedDevice']();
      expect(device).toBe('');
    });
  });

  describe('getPackageName', () => {
    it('should extract applicationId from build.gradle', async () => {
      mockedFsReadFile.mockResolvedValue(
        'apply plugin: "com.android.application"\nandroid { defaultConfig { applicationId "com.example.app" } }'
      );
      mockedPathExists.mockResolvedValue(true);

      const result = await command['getPackageName']('/android');
      expect(result).toBe('com.example.app');
    });

    it('should return null when build.gradle not found', async () => {
      mockedPathExists.mockResolvedValue(false);

      const result = await command['getPackageName']('/android');
      expect(result).toBeNull();
    });

    it('should return null when applicationId not in file', async () => {
      mockedFsReadFile.mockResolvedValue('apply plugin: "com.android.application"');
      mockedPathExists.mockResolvedValue(true);

      const result = await command['getPackageName']('/android');
      expect(result).toBeNull();
    });

    it('should return null when readFile throws', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedFsReadFile.mockRejectedValue(new Error('EACCES'));

      const result = await command['getPackageName']('/android');
      expect(result).toBeNull();
    });
  });

  describe('launchApp', () => {
    it('should launch app when package and device present', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true));

      await command['launchApp']('com.example.app', 'emulator-5554');

      expect(mockedExec).toHaveBeenCalledWith(
        'adb',
        expect.arrayContaining(['shell']),
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    it('should warn when launch fails but package and device present', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false));

      await command['launchApp']('com.example.app', 'emulator-5554');

      const { logger } = jest.requireMock('../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not auto-launch'));
    });

    it('should succeed without launching when no package', async () => {
      await command['launchApp'](null, 'emulator-5554');

      expect(mockedExec).not.toHaveBeenCalled();
    });
  });

  describe('monitorLogs', () => {
    function createMockProc() {
      const proc = new EventEmitter() as any;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = jest.fn();
      proc.killed = false;
      return proc;
    }

    async function waitForSpawn(): Promise<void> {
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setImmediate(r));
        if (mockedSpawn.mock.calls.length > 0) return;
      }
      throw new Error('spawn was never called');
    }

    it('should resolve on process exit', async () => {
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('emulator-5554');
      await waitForSpawn();

      mockProc.emit('exit', 0);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on error when not cleaning up', async () => {
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('emulator-5554');
      await waitForSpawn();

      mockProc.emit('error', new Error('adb crashed'));

      await expect(promise).rejects.toThrow('adb crashed');
    });

    it('should resolve on error when cleaning up', async () => {
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);
      (command as any).isCleaningUp = true;

      const promise = command['monitorLogs']('emulator-5554');
      await waitForSpawn();

      mockProc.emit('error', new Error('adb crashed'));

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
