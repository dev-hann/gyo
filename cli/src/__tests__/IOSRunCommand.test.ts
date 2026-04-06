jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
  showYAMLParsingError: jest.requireActual('../utils/exec').showYAMLParsingError,
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
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import { IOSRunCommand } from '../commands/run/IOSRunCommand';
import { executeCommand, checkCommandExists } from '../utils/exec';
import { pathExists, readFile } from '../utils/fs';
import { BuildFailedError } from '../core/errors';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedReadFile = readFile as unknown as jest.Mock;
const mockedFsEnsureDir = fs.ensureDir as unknown as jest.Mock;
const mockedFsWriteFile = fs.writeFile as unknown as jest.Mock;
const mockedFsRemove = fs.remove as unknown as jest.Mock;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

function makeExecResult(success: boolean, stdout = '', stderr = '') {
  return Promise.resolve({ success, stdout, stderr, code: success ? 0 : 1 });
}

describe('IOSRunCommand', () => {
  let command: IOSRunCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new IOSRunCommand();
    (command as any).options = { profile: 'development' };
    (command as any).projectPath = '/project';
  });

  describe('checkXtoolAvailable', () => {
    it('should pass when xtool exists', async () => {
      mockedCheck.mockResolvedValue(true);

      await expect(command['checkXtoolAvailable']()).resolves.toBeUndefined();
    });

    it('should throw ToolRequiredError when xtool not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await expect(command['checkXtoolAvailable']()).rejects.toThrow('Required tool');
    });
  });

  describe('getBundleId', () => {
    it('should extract bundleID from xtool.yml', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue('name: MyApp\nbundleID: com.example.myapp\ntarget: app');

      const result = await command['getBundleId']('/ios');
      expect(result).toBe('com.example.myapp');
    });

    it('should throw BuildFailedError when xtool.yml not found', async () => {
      mockedPathExists.mockResolvedValue(false);

      await expect(command['getBundleId']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should throw BuildFailedError when bundleID is missing', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue('name: MyApp\ntarget: app');

      await expect(command['getBundleId']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should throw BuildFailedError when bundleID has mapping value', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue('bundleID:\n  key: value');

      await expect(command['getBundleId']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should throw BuildFailedError when bundleID contains template variable', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue('bundleID: {{appId}}');

      await expect(command['getBundleId']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should re-throw BuildFailedError from inner catch', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadFile.mockRejectedValue(new Error('read error'));

      await expect(command['getBundleId']('/ios')).rejects.toThrow(BuildFailedError);
    });
  });

  describe('buildAndInstallApp', () => {
    it('should throw BuildFailedError on build failure', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'error'));

      await expect(command['buildAndInstallApp']('/ios', 'com.example.app')).rejects.toThrow(
        BuildFailedError
      );
    });

    it('should return original bundleId when no extended bundle found', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true, 'build ok', ''));
      mockedCheck.mockResolvedValue(false);

      const result = await command['buildAndInstallApp']('/ios', 'com.example.app');
      expect(result).toBe('com.example.app');
    });

    it('should discover full bundle ID from build output', async () => {
      mockedExec.mockResolvedValue(
        await makeExecResult(true, 'bundleIDs = ("XTL-ABC123.com.example.app")', '')
      );

      const result = await command['buildAndInstallApp']('/ios', 'com.example.app');
      expect(result).toBe('XTL-ABC123.com.example.app');
    });

    it('should show YAML parsing hints on typeMismatch build failure', async () => {
      mockedExec.mockResolvedValue(
        await makeExecResult(false, '', 'error: typeMismatch in xtool.yml')
      );

      await expect(command['buildAndInstallApp']('/ios', 'com.example.app')).rejects.toThrow(
        BuildFailedError
      );

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('YAML parsing error'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bundleID'));
    });

    it('should show YAML parsing hints on Expected to decode Scalar failure', async () => {
      mockedExec.mockResolvedValue(
        await makeExecResult(false, '', 'fatal error: Expected to decode Scalar')
      );

      await expect(command['buildAndInstallApp']('/ios', 'com.example.app')).rejects.toThrow(
        BuildFailedError
      );

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('YAML parsing error'));
    });

    it('should discover bundle ID from XTL pattern in stderr', async () => {
      mockedExec.mockResolvedValue(
        await makeExecResult(true, '', 'Installed XTL-XYZ789.com.example.app successfully')
      );

      const result = await command['buildAndInstallApp']('/ios', 'com.example.app');
      expect(result).toBe('XTL-XYZ789.com.example.app');
    });
  });

  describe('updateServerUrl', () => {
    it('should write config and clean build cache', async () => {
      mockedPathExists.mockResolvedValue(true);

      await command['updateServerUrl']('/ios', 'http://192.168.1.1:3000');

      expect(mockedFsEnsureDir).toHaveBeenCalled();
      expect(mockedFsWriteFile).toHaveBeenCalled();
      expect(mockedFsRemove).toHaveBeenCalled();
    });
  });

  describe('showSuccessMessage', () => {
    it('should log success with server URL and tap hint', () => {
      command['showSuccessMessage']('http://192.168.1.1:3000');

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('tap the app icon'));
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('http://192.168.1.1:3000')
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Ctrl+C'));
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

    it('should warn and resolve when idevicesyslog not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await command['monitorLogs']('com.example.app');

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('idevicesyslog not found'));
    });

    it('should spawn idevicesyslog with -m flag', async () => {
      mockedCheck.mockResolvedValue(true);
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('com.example.app');
      await waitForSpawn();

      expect(mockedSpawn).toHaveBeenCalledWith(
        'idevicesyslog',
        ['-m', 'com.example.app'],
        expect.objectContaining({ detached: true })
      );

      mockProc.emit('exit', 0);
      await promise;
    });

    it('should resolve on process exit', async () => {
      mockedCheck.mockResolvedValue(true);
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('com.example.app');
      await waitForSpawn();

      mockProc.emit('exit', 0);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on error when not cleaning up', async () => {
      mockedCheck.mockResolvedValue(true);
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('com.example.app');
      await waitForSpawn();

      mockProc.emit('error', new Error('spawn failed'));

      await expect(promise).rejects.toThrow('spawn failed');
    });

    it('should resolve on error when cleaning up', async () => {
      mockedCheck.mockResolvedValue(true);
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);
      (command as any).isCleaningUp = true;

      const promise = command['monitorLogs']('com.example.app');
      await waitForSpawn();

      mockProc.emit('error', new Error('spawn failed'));

      await expect(promise).resolves.toBeUndefined();
    });

    it('should warn when process exits with non-zero code', async () => {
      mockedCheck.mockResolvedValue(true);
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('com.example.app');
      await waitForSpawn();

      mockProc.emit('exit', 1);

      await expect(promise).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('Log monitoring stopped');
    });

    it('should log stdout lines as info', async () => {
      mockedCheck.mockResolvedValue(true);
      const mockProc = createMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['monitorLogs']('com.example.app');
      await waitForSpawn();

      mockProc.stdout.emit('data', Buffer.from('log line 1\nlog line 2\n'));

      mockProc.emit('exit', 0);
      await promise;

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('log line 1'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('log line 2'));
    });
  });

  describe('findBundleIdFromSyslog', () => {
    function createSyslogMockProc() {
      const proc = new EventEmitter() as any;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = jest.fn();
      proc.killed = false;
      return proc;
    }

    it('should return original bundleId when syslog process exits early', async () => {
      const mockProc = createSyslogMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['findBundleIdFromSyslog']('com.example.app');

      await new Promise((r) => setImmediate(r));
      mockProc.emit('exit', 1);

      const result = await promise;
      expect(result).toBe('com.example.app');
    });

    it('should return original bundleId when syslog process errors', async () => {
      const mockProc = createSyslogMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['findBundleIdFromSyslog']('com.example.app');

      await new Promise((r) => setImmediate(r));
      mockProc.emit('error', new Error('spawn error'));

      const result = await promise;
      expect(result).toBe('com.example.app');
    });

    it('should extract bundleId from syslog output', async () => {
      const mockProc = createSyslogMockProc();
      mockedSpawn.mockReturnValue(mockProc as any);

      const promise = command['findBundleIdFromSyslog']('com.example.app');

      await new Promise((r) => setImmediate(r));
      mockProc.stdout.emit('data', Buffer.from('some log XTL-ABC123.com.example.app more log\n'));

      const result = await promise;
      expect(result).toBe('XTL-ABC123.com.example.app');
    });
  });
});
