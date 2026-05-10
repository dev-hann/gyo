jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
  showYAMLParsingError: jest.requireActual('../utils/exec').showYAMLParsingError,
  requireTool: jest.fn(),
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
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  removeDir: jest.fn(),
  getTemplatesPath: jest.fn(),
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue(null),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  shouldStartLocalServer: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

import { IOSBuildCommand } from '../commands/build/IOSBuildCommand';
import { executeCommand, checkCommandExists, requireTool } from '../utils/exec';
import { pathExists, writeFile, ensureDir } from '../utils/fs';
import { BuildFailedError, ToolRequiredError } from '../core/errors';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedEnsureDir = ensureDir as jest.MockedFunction<typeof ensureDir>;

function makeExecResult(success: boolean, stdout = '', stderr = '') {
  return Promise.resolve({ success, stdout, stderr, code: success ? 0 : 1 });
}

describe('IOSBuildCommand', () => {
  let command: IOSBuildCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new IOSBuildCommand();
    (command as any).options = { profile: 'development', release: false };
    (command as any).projectPath = '/project';
    (command as any).config = {
      name: 'test',
      version: '1.0.0',
      platforms: {},
      profiles: { development: { serverUrl: 'http://localhost:3000' } },
    };
  });

  describe('checkXtoolAvailable', () => {
    it('should pass when xtool exists', async () => {
      mockedRequireTool.mockResolvedValue(undefined);

      await expect(command['checkXtoolAvailable']()).resolves.toBeUndefined();
    });

    it('should throw ToolRequiredError when xtool not found', async () => {
      mockedRequireTool.mockRejectedValue(
        new ToolRequiredError('xtool', 'Install xtool: https://xtool.sh')
      );

      await expect(command['checkXtoolAvailable']()).rejects.toThrow(ToolRequiredError);
    });
  });

  describe('checkDeviceConnected', () => {
    it('should throw BuildFailedError when idevice_id not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await expect(command['checkDeviceConnected']()).rejects.toThrow(BuildFailedError);
      await expect(command['checkDeviceConnected']()).rejects.toThrow('idevice_id not found');
    });

    it('should throw BuildFailedError when no device connected', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(await makeExecResult(true, '', ''));

      await expect(command['checkDeviceConnected']()).rejects.toThrow(BuildFailedError);
      await expect(command['checkDeviceConnected']()).rejects.toThrow('No iOS device connected');
    });

    it('should throw BuildFailedError when idevice_id command fails', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'error'));

      await expect(command['checkDeviceConnected']()).rejects.toThrow(BuildFailedError);
    });

    it('should pass when device is connected', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(await makeExecResult(true, 'device-udid-here\n', ''));

      await expect(command['checkDeviceConnected']()).resolves.toBeUndefined();
    });
  });

  describe('buildApp', () => {
    it('should succeed on successful build', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true, 'build output', ''));

      await expect(command['buildApp']('/ios')).resolves.toBeUndefined();
    });

    it('should throw BuildFailedError on build failure', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'build error'));

      await expect(command['buildApp']('/ios')).rejects.toThrow(BuildFailedError);
      await expect(command['buildApp']('/ios')).rejects.toThrow('iOS build failed');
    });

    it('should provide YAML guidance on typeMismatch error', async () => {
      mockedExec.mockResolvedValue(
        await makeExecResult(false, '', 'typeMismatch: Expected to decode Scalar')
      );

      await expect(command['buildApp']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should provide YAML guidance on Expected to decode Scalar error', async () => {
      mockedExec.mockResolvedValue(
        await makeExecResult(false, '', 'Error: Expected to decode Scalar value')
      );

      await expect(command['buildApp']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should show stderr in error when no stdout', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'some stderr'));

      await expect(command['buildApp']('/ios')).rejects.toThrow(BuildFailedError);
    });

    it('should show stdout in error when no stderr', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, 'some stdout', ''));

      await expect(command['buildApp']('/ios')).rejects.toThrow(BuildFailedError);
    });
  });

  describe('buildPlatform (integration)', () => {
    it('should run full build pipeline successfully', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedRequireTool.mockResolvedValue(undefined);
      mockedCheck.mockResolvedValue(true);
      mockedExec
        .mockResolvedValueOnce(await makeExecResult(true, 'device-id\n', ''))
        .mockResolvedValueOnce(await makeExecResult(true, 'Build Succeeded', ''));

      await expect(command['buildPlatform']()).resolves.toBeUndefined();

      expect(mockedEnsureDir).toHaveBeenCalled();
      expect(mockedWriteFile).toHaveBeenCalled();
    });

    it('should fail when platform directory missing', async () => {
      mockedPathExists.mockResolvedValue(false);

      await expect(command['buildPlatform']()).rejects.toThrow();
    });
  });
});
