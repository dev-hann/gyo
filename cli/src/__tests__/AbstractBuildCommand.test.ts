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
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  removeDir: jest.fn(),
  getTemplatesPath: jest.fn(),
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  shouldStartLocalServer: jest.fn(),
}));

import { AbstractBuildCommand } from '../commands/build/AbstractBuildCommand';
import { CommandMeta } from '../commands/base/BaseCommand';
import { executeCommand } from '../utils/exec';
import { pathExists, writeFile, ensureDir } from '../utils/fs';
import { getProfileUrl } from '../services/config.service';
import { BuildFailedError } from '../core/index';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedEnsureDir = ensureDir as jest.MockedFunction<typeof ensureDir>;

class TestableBuildCommand extends AbstractBuildCommand {
  getMeta(): CommandMeta {
    return { name: 'test-build', description: 'test' };
  }

  public testBuildLibAssets(): Promise<void> {
    return this.buildLibAssets();
  }

  public testGetServerUrl(): string {
    return this.getServerUrl();
  }

  public testWriteConfigFile(configPath: string, serverUrl: string): Promise<void> {
    return this.writeConfigFile(configPath, serverUrl);
  }

  protected buildPlatform(): Promise<void> {
    return Promise.resolve();
  }
}

describe('AbstractBuildCommand', () => {
  let command: TestableBuildCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableBuildCommand();
    (command as any).options = { profile: 'development', release: false };
  });

  describe('buildLibAssets', () => {
    it('should skip when lib directory does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);

      await command.testBuildLibAssets();

      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should build when lib directory exists', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedExec.mockResolvedValue({
        success: true,
        stdout: 'built',
        stderr: '',
        code: 0,
      });

      await command.testBuildLibAssets();

      expect(mockedExec).toHaveBeenCalledWith(
        'npm',
        ['run', 'build'],
        expect.objectContaining({ stdio: 'pipe' })
      );
    });

    it('should throw BuildFailedError when lib build fails', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedExec.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'error',
        code: 1,
      });

      await expect(command.testBuildLibAssets()).rejects.toThrow(BuildFailedError);
    });
  });

  describe('getServerUrl', () => {
    it('should throw when config not loaded', () => {
      (command as any).config = null;

      expect(() => command.testGetServerUrl()).toThrow('Configuration not loaded');
    });

    it('should return URL from profile', () => {
      (command as any).config = { name: 'test', version: '1.0.0', platforms: {} };

      const url = command.testGetServerUrl();

      expect(getProfileUrl).toHaveBeenCalled();
      expect(url).toBe('http://localhost:3000');
    });
  });

  describe('writeConfigFile', () => {
    it('should write config JSON with server URL', async () => {
      await command.testWriteConfigFile('/tmp/gyo-config.json', 'http://192.168.1.1:3000');

      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/gyo-config.json',
        expect.stringContaining('192.168.1.1')
      );
    });

    it('should ensure directory exists before writing', async () => {
      await command.testWriteConfigFile('/tmp/sub/gyo-config.json', 'http://localhost:3000');

      expect(mockedEnsureDir).toHaveBeenCalledWith('/tmp/sub');
    });
  });
});
