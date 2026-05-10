import { PlatformCommand } from '../commands/base/PlatformCommand';
import type { CommandMeta } from '../commands/base/BaseCommand';
import type { Platform } from '../core/index';
import { PlatformNotFoundError, PlatformDisabledError } from '../core/index';

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue(null),
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

import { loadConfig } from '../services/config.service';
import { pathExists } from '../utils/fs';

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;

class TestablePlatformCommand extends PlatformCommand {
  getMeta(): CommandMeta {
    return { name: 'test-platform', description: 'test' };
  }

  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  protected run(): Promise<void> {
    return Promise.resolve();
  }
}

describe('PlatformCommand', () => {
  let command: TestablePlatformCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPathExists.mockImplementation((p: string) =>
      Promise.resolve(typeof p === 'string' && p.includes('gyo.config.json'))
    );
    command = new TestablePlatformCommand();
  });

  describe('setPlatform', () => {
    it('should set the platform', () => {
      command.setPlatform('ios');

      expect(command['platform']).toBe('ios');
    });
  });

  describe('validatePlatform', () => {
    it('should pass for valid platform', () => {
      command.setPlatform('android');

      expect(() => command.execute()).not.toThrow();
    });

    it('should throw PlatformNotFoundError for invalid platform', async () => {
      command.setPlatform('windows' as Platform);
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: {},
      });

      await expect(command.execute()).rejects.toThrow(PlatformNotFoundError);
    });
  });

  describe('validatePlatformEnabled', () => {
    it('should throw PlatformDisabledError when platform is disabled', async () => {
      command.setPlatform('android');
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: { android: { enabled: false } },
      });

      await expect(command.execute()).rejects.toThrow(PlatformDisabledError);
    });

    it('should pass when platform is enabled', async () => {
      command.setPlatform('android');
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: { android: { enabled: true } },
      });

      await expect(command.execute()).resolves.toBeUndefined();
    });

    it('should pass when config has no platforms', async () => {
      command.setPlatform('android');
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: {},
      });

      await expect(command.execute()).resolves.toBeUndefined();
    });
  });

  describe('runDirectly', () => {
    it('should run all lifecycle steps successfully', async () => {
      command.setPlatform('android');
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: {},
      });

      await expect(command.runDirectly()).resolves.toBeUndefined();
    });

    it('should throw PlatformNotFoundError directly without handleError', async () => {
      command.setPlatform('windows' as Platform);

      await expect(command.runDirectly()).rejects.toThrow(PlatformNotFoundError);
    });

    it('should throw GyoError when gyo.config.json not found', async () => {
      command.setPlatform('android');
      mockedPathExists.mockResolvedValue(false);

      await expect(command.runDirectly()).rejects.toThrow('Not a gyo project');
    });

    it('should throw PlatformDisabledError when platform disabled', async () => {
      command.setPlatform('android');
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: { android: { enabled: false } },
      });

      await expect(command.runDirectly()).rejects.toThrow(PlatformDisabledError);
    });
  });

  describe('checkPlatformDirectoryExists', () => {
    it('should throw PlatformNotFoundError when directory missing', async () => {
      command.setPlatform('android');
      mockedPathExists.mockResolvedValue(false);
      mockedLoadConfig.mockResolvedValue({
        name: 'test',
        version: '1.0.0',
        platforms: {},
      });

      try {
        await command['checkPlatformDirectoryExists']();
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformNotFoundError);
      }
    });

    it('should pass when directory exists', async () => {
      command.setPlatform('android');
      mockedPathExists.mockResolvedValue(true);

      await expect(command['checkPlatformDirectoryExists']()).resolves.toBeUndefined();
    });
  });
});
