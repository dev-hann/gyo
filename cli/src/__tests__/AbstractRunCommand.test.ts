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
  saveConfig: jest.fn().mockResolvedValue(undefined),
  getProfileUrl: jest.fn(),
  shouldStartLocalServer: jest.fn(),
}));

import { AbstractRunCommand } from '../commands/run/AbstractRunCommand';
import { CommandMeta } from '../commands/base/BaseCommand';
import { saveConfig } from '../services/config.service';
import { DEFAULT_PORT } from '../core/index';

const mockedSaveConfig = saveConfig as jest.MockedFunction<typeof saveConfig>;

class TestableRunCommand extends AbstractRunCommand {
  getMeta(): CommandMeta {
    return { name: 'test-run', description: 'test' };
  }

  public testGetPortFromProfile(profile: string): number {
    return this.getPortFromProfile(profile);
  }

  public testGetStartCommand(): string {
    return this.getStartCommand();
  }

  public testUpdateProfileUrl(profile: string, serverUrl: string): Promise<void> {
    return this.updateProfileUrl(profile, serverUrl);
  }

  public testGetLocalIP(): Promise<string> {
    return this.getLocalIP();
  }

  protected runPlatform(): Promise<void> {
    return Promise.resolve();
  }
}

describe('AbstractRunCommand', () => {
  let command: TestableRunCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableRunCommand();
    (command as any).options = { profile: 'development' };
  });

  describe('getStartCommand', () => {
    it('should return configured start command', () => {
      (command as any).config = {
        script: { start: 'npm run dev' },
      };

      expect(command.testGetStartCommand()).toBe('npm run dev');
    });

    it('should trim whitespace from command', () => {
      (command as any).config = {
        script: { start: '  npm run dev  ' },
      };

      expect(command.testGetStartCommand()).toBe('npm run dev');
    });

    it('should throw when start command is not configured', () => {
      (command as any).config = {};

      expect(() => command.testGetStartCommand()).toThrow('Start command is not configured');
    });

    it('should throw when start command is empty string', () => {
      (command as any).config = { script: { start: '   ' } };

      expect(() => command.testGetStartCommand()).toThrow('Start command is not configured');
    });
  });

  describe('getPortFromProfile', () => {
    it('should return default port when profile not found', () => {
      (command as any).config = { profiles: {} };

      expect(command.testGetPortFromProfile('production')).toBe(DEFAULT_PORT);
    });

    it('should return default port when config has no profiles', () => {
      (command as any).config = {};

      expect(command.testGetPortFromProfile('development')).toBe(DEFAULT_PORT);
    });

    it('should extract port from profile serverUrl', () => {
      (command as any).config = {
        profiles: {
          development: { serverUrl: 'http://localhost:8080' },
        },
      };

      expect(command.testGetPortFromProfile('development')).toBe(8080);
    });

    it('should return default port when URL has no explicit port', () => {
      (command as any).config = {
        profiles: {
          production: { serverUrl: 'https://example.com' },
        },
      };

      expect(command.testGetPortFromProfile('production')).toBe(DEFAULT_PORT);
    });

    it('should return default port for invalid URL', () => {
      (command as any).config = {
        profiles: {
          development: { serverUrl: 'not-a-url' },
        },
      };

      expect(command.testGetPortFromProfile('development')).toBe(DEFAULT_PORT);
    });
  });

  describe('updateProfileUrl', () => {
    it('should create profiles object if missing', async () => {
      (command as any).config = { name: 'test', version: '1.0.0', platforms: {} };

      await command.testUpdateProfileUrl('development', 'http://192.168.1.1:3000');

      expect((command as any).config.profiles).toEqual({
        development: { serverUrl: 'http://192.168.1.1:3000' },
      });
      expect(mockedSaveConfig).toHaveBeenCalled();
    });

    it('should update existing profile serverUrl', async () => {
      (command as any).config = {
        name: 'test',
        version: '1.0.0',
        platforms: {},
        profiles: { development: { serverUrl: 'http://old:3000' } },
      };

      await command.testUpdateProfileUrl('development', 'http://new:3000');

      expect((command as any).config.profiles.development.serverUrl).toBe('http://new:3000');
    });

    it('should do nothing when config is null', async () => {
      (command as any).config = null;

      await command.testUpdateProfileUrl('development', 'http://localhost:3000');

      expect(mockedSaveConfig).not.toHaveBeenCalled();
    });
  });

  describe('getLocalIP', () => {
    it('should return localhost when no external interface found', async () => {
      const ip = await command.testGetLocalIP();

      expect(typeof ip).toBe('string');
      expect(ip.length).toBeGreaterThan(0);
    });
  });
});
