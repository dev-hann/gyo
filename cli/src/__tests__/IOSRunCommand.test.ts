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
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

import fs from 'fs-extra';
import { IOSRunCommand } from '../commands/run/IOSRunCommand';
import { executeCommand, checkCommandExists } from '../utils/exec';
import { pathExists, readFile } from '../utils/fs';
import { CommandNotFoundError, BuildFailedError } from '../core/errors';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedReadFile = readFile as unknown as jest.Mock;
const mockedFsEnsureDir = fs.ensureDir as unknown as jest.Mock;
const mockedFsWriteFile = fs.writeFile as unknown as jest.Mock;
const mockedFsRemove = fs.remove as unknown as jest.Mock;

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

    it('should throw CommandNotFoundError when xtool not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await expect(command['checkXtoolAvailable']()).rejects.toThrow(CommandNotFoundError);
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
});
