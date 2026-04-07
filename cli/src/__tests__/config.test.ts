import { ConfigCommand } from '../commands/config';

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
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

import { loadConfig, saveConfig } from '../services/config.service';
import { logger } from '../utils/logger';
import { GyoError } from '../core/errors';

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockedSaveConfig = saveConfig as jest.MockedFunction<typeof saveConfig>;

describe('ConfigCommand', () => {
  let command: ConfigCommand;

  const mockConfig = {
    name: 'test-project',
    version: '1.0.0',
    profiles: {
      development: {
        serverUrl: 'http://localhost:3000',
      },
    },
    platforms: {
      android: { enabled: true, packageName: 'com.example.test' },
      ios: { enabled: true, bundleId: 'com.example.test' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ConfigCommand();
    mockedLoadConfig.mockResolvedValue(mockConfig as never);
  });

  describe('getSubcommands', () => {
    it('should return show, set, and get subcommands', () => {
      const subcommands = ConfigCommand.getSubcommands();
      expect(subcommands).toHaveLength(3);
      expect(subcommands.map((s) => s.name)).toEqual(['show', 'set', 'get']);
    });
  });

  describe('getMeta', () => {
    it('should return config command metadata', () => {
      const meta = command.getMeta();
      expect(meta.name).toBe('config');
      expect(meta.description).toBe('Manage gyo configuration');
    });
  });

  describe('setAction', () => {
    it('should set action to show', () => {
      command.setAction('show');
      expect(command['options'].action).toBe('show');
    });

    it('should set action to set', () => {
      command.setAction('set');
      expect(command['options'].action).toBe('set');
    });

    it('should set action to get', () => {
      command.setAction('get');
      expect(command['options'].action).toBe('get');
    });
  });

  describe('setKeyValue', () => {
    it('should set key and value', () => {
      command.setKeyValue('test.key', 'value');
      expect(command['options'].key).toBe('test.key');
      expect(command['options'].value).toBe('value');
    });

    it('should set key without value', () => {
      command.setKeyValue('test.key');
      expect(command['options'].key).toBe('test.key');
      expect(command['options'].value).toBeUndefined();
    });
  });

  describe('showConfig', () => {
    it('should display configuration when config exists', async () => {
      mockedLoadConfig.mockResolvedValue(mockConfig as never);

      await command['showConfig']();

      expect(logger.info).toHaveBeenCalledWith('Current gyo configuration:\n');
      expect(logger.log).toHaveBeenCalledWith(JSON.stringify(mockConfig, null, 2));
    });

    it('should throw GyoError when config not found', async () => {
      mockedLoadConfig.mockResolvedValue(null);

      await expect(command['showConfig']()).rejects.toThrow(GyoError);
      await expect(command['showConfig']()).rejects.toThrow(
        "Configuration not found. Run 'gyo create' to scaffold a project"
      );
    });
  });

  describe('setConfig', () => {
    it('should throw GyoError when key is missing', async () => {
      command['options'] = { action: 'set' };

      await expect(command['setConfig']()).rejects.toThrow(GyoError);
      await expect(command['setConfig']()).rejects.toThrow(
        'Key and value are required for set operation'
      );
    });

    it('should throw GyoError when value is missing', async () => {
      command['options'] = { action: 'set', key: 'test.key' };

      await expect(command['setConfig']()).rejects.toThrow(GyoError);
      await expect(command['setConfig']()).rejects.toThrow(
        'Key and value are required for set operation'
      );
    });

    it('should throw GyoError when config not found', async () => {
      mockedLoadConfig.mockResolvedValue(null);
      command['options'] = { action: 'set', key: 'test.key', value: 'value' };

      await expect(command['setConfig']()).rejects.toThrow(GyoError);
      await expect(command['setConfig']()).rejects.toThrow('Configuration not found');
    });

    it('should set string value', async () => {
      const modifiedConfig = { ...mockConfig };
      modifiedConfig.profiles.development.serverUrl = 'http://localhost:3000';
      mockedLoadConfig.mockResolvedValue(modifiedConfig as never);
      mockedSaveConfig.mockResolvedValue(undefined as never);

      command['options'] = {
        action: 'set',
        key: 'profiles.development.serverUrl',
        value: 'http://localhost:4000',
      };

      await command['setConfig']();

      expect(mockedSaveConfig).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith(
        'Set profiles.development.serverUrl = http://localhost:4000 (was: "http://localhost:3000")'
      );
    });

    it('should parse boolean true values', async () => {
      const modifiedConfig = { ...mockConfig };
      (modifiedConfig.profiles as any).testFlag = false;
      mockedLoadConfig.mockResolvedValue(modifiedConfig as never);
      mockedSaveConfig.mockResolvedValue(undefined as never);

      command['options'] = { action: 'set', key: 'profiles.testFlag', value: 'true' };

      await command['setConfig']();

      expect((modifiedConfig.profiles as any).testFlag).toBe(true);
      expect(logger.success).toHaveBeenCalledWith('Set profiles.testFlag = true (was: false)');
    });

    it('should parse boolean false values', async () => {
      const modifiedConfig = { ...mockConfig };
      (modifiedConfig.profiles as any).testFlag = true;
      mockedLoadConfig.mockResolvedValue(modifiedConfig as never);
      mockedSaveConfig.mockResolvedValue(undefined as never);

      command['options'] = { action: 'set', key: 'profiles.testFlag', value: 'false' };

      await command['setConfig']();

      expect((modifiedConfig.profiles as any).testFlag).toBe(false);
      expect(logger.success).toHaveBeenCalledWith('Set profiles.testFlag = false (was: true)');
    });

    it('should parse number values', async () => {
      const modifiedConfig = { ...mockConfig };
      (modifiedConfig.profiles as any).port = 3000;
      mockedLoadConfig.mockResolvedValue(modifiedConfig as never);
      mockedSaveConfig.mockResolvedValue(undefined as never);

      command['options'] = { action: 'set', key: 'profiles.port', value: '4000' };

      await command['setConfig']();

      expect((modifiedConfig.profiles as any).port).toBe(4000);
      expect(logger.success).toHaveBeenCalledWith('Set profiles.port = 4000 (was: 3000)');
    });

    it('should throw GyoError for invalid key path', async () => {
      const modifiedConfig = { ...mockConfig };
      mockedLoadConfig.mockResolvedValue(modifiedConfig as never);

      command['options'] = { action: 'set', key: 'invalid.path.here', value: 'value' };

      await expect(command['setConfig']()).rejects.toThrow(GyoError);
      await expect(command['setConfig']()).rejects.toThrow(
        'Invalid configuration key: invalid.path.here'
      );
    });
  });

  describe('getConfig', () => {
    it('should throw GyoError when key is missing', async () => {
      command['options'] = { action: 'get' };

      await expect(command['getConfig']()).rejects.toThrow(GyoError);
      await expect(command['getConfig']()).rejects.toThrow('Key is required for get operation');
    });

    it('should throw GyoError when config not found', async () => {
      mockedLoadConfig.mockResolvedValue(null);
      command.setKeyValue('test.key');

      await expect(command['getConfig']()).rejects.toThrow(GyoError);
      await expect(command['getConfig']()).rejects.toThrow('Configuration not found');
    });

    it('should get configuration value', async () => {
      const originalConfig = { ...mockConfig };
      originalConfig.profiles.development.serverUrl = 'http://localhost:3000';
      mockedLoadConfig.mockResolvedValue(originalConfig as never);
      command['options'] = { action: 'get', key: 'profiles.development.serverUrl' };

      await command['getConfig']();

      expect(logger.info).toHaveBeenCalledWith(
        'profiles.development.serverUrl = "http://localhost:3000"'
      );
    });

    it('should throw GyoError for invalid key path', async () => {
      mockedLoadConfig.mockResolvedValue(mockConfig as never);
      command['options'] = { action: 'get', key: 'invalid.path.here' };

      await expect(command['getConfig']()).rejects.toThrow(GyoError);
      await expect(command['getConfig']()).rejects.toThrow(
        'Configuration key not found: invalid.path.here'
      );
    });

    it('should get nested configuration value', async () => {
      mockedLoadConfig.mockResolvedValue(mockConfig as never);
      command['options'] = { action: 'get', key: 'platforms.android.enabled' };

      await command['getConfig']();

      expect(logger.info).toHaveBeenCalledWith('platforms.android.enabled = true');
    });
  });
});
