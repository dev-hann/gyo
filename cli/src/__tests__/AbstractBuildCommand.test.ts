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
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  shouldStartLocalServer: jest.fn(),
}));

jest.mock('../services/web-server.service', () => ({
  WebServerService: jest.fn(),
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  default: { prompt: jest.fn() },
}));

import { AbstractBuildCommand } from '../commands/build/AbstractBuildCommand';
import type { CommandMeta } from '../commands/base/BaseCommand';
import type { GyoConfig } from '../core/index';
import { executeCommand } from '../utils/exec';
import { pathExists, writeFile, ensureDir } from '../utils/fs';
import { saveConfig, shouldStartLocalServer } from '../services/config.service';
import inquirer from 'inquirer';
import { BuildFailedError, GyoError } from '../core/index';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedEnsureDir = ensureDir as jest.MockedFunction<typeof ensureDir>;
const mockedSaveConfig = saveConfig as jest.MockedFunction<typeof saveConfig>;
const mockedPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;
const mockedShouldStartLocalServer = shouldStartLocalServer as jest.MockedFunction<
  typeof shouldStartLocalServer
>;

class TestableBuildCommand extends AbstractBuildCommand {
  getMeta(): CommandMeta {
    return { name: 'test-build', description: 'test' };
  }

  public testBuildLibAssets(): Promise<void> {
    return this.buildLibAssets();
  }

  public async testResolveServerUrl(): Promise<string> {
    return this.resolveServerUrl();
  }

  public testWriteConfigFile(
    configPath: string,
    serverUrl: string,
    webview?: GyoConfig['webview']
  ): Promise<void> {
    return this.writeConfigFile(configPath, serverUrl, webview);
  }

  protected buildPlatform(): Promise<void> {
    return Promise.resolve();
  }
}

/** A command whose LAN lookup answers `lanUrl`; the development profile is active. */
function buildCommandWithLanAddress(lanUrl: string): TestableBuildCommand {
  const { WebServerService } = jest.requireMock('../services/web-server.service');
  const resolveServerUrl = jest.fn().mockResolvedValue(lanUrl);
  WebServerService.mockImplementation(() => ({ resolveServerUrl }));
  mockedShouldStartLocalServer.mockReturnValue(true);
  const command = new TestableBuildCommand();
  (command as any).options = { profile: 'development', release: false };
  return command;
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

  describe('resolveServerUrl', () => {
    it('should throw when config not loaded', async () => {
      (command as any).config = null;

      await expect(command.testResolveServerUrl()).rejects.toThrow('Configuration not loaded');
    });

    it('should return URL from profile when configured', async () => {
      (command as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: { development: { serverUrl: 'https://deploy.example.com' } },
      };

      const url = await command.testResolveServerUrl();

      expect(url).toBe('https://deploy.example.com');
      expect(mockedPrompt).not.toHaveBeenCalled();
      expect(mockedSaveConfig).not.toHaveBeenCalled();
    });

    it('should replace localhost with the LAN address for the development profile', async () => {
      const local = buildCommandWithLanAddress('http://192.168.1.5:3000');
      (local as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: { development: { serverUrl: 'http://localhost:3000' } },
      };

      const url = await local.testResolveServerUrl();

      expect(url).toBe('http://192.168.1.5:3000');
    });

    it('should keep localhost for profiles that do not start a local server', async () => {
      const local = buildCommandWithLanAddress('http://192.168.1.5:3000');
      (local as any).options = { profile: 'production', release: false };
      (local as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: { production: { serverUrl: 'http://localhost:3000' } },
      };
      mockedShouldStartLocalServer.mockReturnValue(false);

      const url = await local.testResolveServerUrl();

      expect(url).toBe('http://localhost:3000');
    });

    it('should keep a configured host for the development profile', async () => {
      const local = buildCommandWithLanAddress('http://192.168.1.5:3000');
      (local as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: { development: { serverUrl: 'http://10.0.2.2:3000' } },
      };

      const url = await local.testResolveServerUrl();

      expect(url).toBe('http://10.0.2.2:3000');
    });

    it('should prompt for URL when profile has no serverUrl and save it', async () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
      (command as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: { development: { serverUrl: 'http://localhost:3000' } },
      };
      (command as any).options = { profile: 'production', release: false };
      mockedPrompt.mockResolvedValueOnce({ url: 'https://prod.example.com' });

      const url = await command.testResolveServerUrl();

      expect(mockedPrompt).toHaveBeenCalled();
      expect(url).toBe('https://prod.example.com');
      expect((command as any).config.profiles.production.serverUrl).toBe(
        'https://prod.example.com'
      );
      expect(mockedSaveConfig).toHaveBeenCalled();

      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    it('should throw in non-interactive environment when serverUrl is missing', async () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
      (command as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: {},
      };

      await expect(command.testResolveServerUrl()).rejects.toThrow(GyoError);
      expect(mockedPrompt).not.toHaveBeenCalled();

      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
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

    it('should include the webview settings the shell has to apply', async () => {
      await command.testWriteConfigFile('/tmp/gyo-config.json', 'http://localhost:3000', {
        userAgent: 'MyApp/1.0',
      });

      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(JSON.parse(content)).toEqual({
        serverUrl: 'http://localhost:3000',
        webview: { userAgent: 'MyApp/1.0' },
      });
    });

    it('should omit webview when no setting applies', async () => {
      await command.testWriteConfigFile('/tmp/gyo-config.json', 'http://localhost:3000', {
        userAgent: 'gyo-webview/1.0',
      });

      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(content).not.toContain('webview');
    });
  });
});
