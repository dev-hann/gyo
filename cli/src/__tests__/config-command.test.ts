import { ConfigCommand } from '../commands/config';

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  validateConfig: jest.fn(),
  setConfigValue: jest.fn(),
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
}));

import { loadConfig, setConfigValue } from '../services/config.service';
import { logger } from '../utils/logger';

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockedSetConfigValue = setConfigValue as jest.MockedFunction<typeof setConfigValue>;

const sampleConfig = {
  name: 'my-app',
  version: '1.0.0',
  serverUrl: 'http://localhost:3000',
  platforms: {
    android: { enabled: true, packageName: 'com.example.myapp' },
    ios: { enabled: true, bundleId: 'com.example.myapp' },
  },
};

function freshConfig() {
  return structuredClone(sampleConfig);
}

describe('ConfigCommand', () => {
  let command: ConfigCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ConfigCommand();
  });

  describe('getSubcommands', () => {
    it('should return show, set, and get subcommands', () => {
      const subcommands = ConfigCommand.getSubcommands();

      expect(subcommands.map((s) => s.name)).toEqual(['show', 'set', 'get']);
    });
  });

  describe('getMeta', () => {
    it('should return the config command metadata', () => {
      const meta = command.getMeta();

      expect(meta.name).toBe('config');
      expect(meta.description).toBe('Manage gyo configuration');
    });
  });

  describe('setAction', () => {
    it('should record the subcommand to run', () => {
      command.setAction('set');

      expect(command['options'].action).toBe('set');
    });
  });

  describe('setKeyValue', () => {
    it('should record the key and the value', () => {
      command.setKeyValue('test.key', 'value');

      expect(command['options']).toMatchObject({ key: 'test.key', value: 'value' });
    });

    it('should record a key without a value', () => {
      command.setKeyValue('test.key');

      expect(command['options'].key).toBe('test.key');
      expect(command['options'].value).toBeUndefined();
    });
  });

  describe('showConfig', () => {
    it('should throw GyoError when config not found', async () => {
      command.setAction('show');
      mockedLoadConfig.mockRejectedValue(new Error('gyo.config.json not found in: /project'));

      await expect(command['run']()).rejects.toThrow('gyo.config.json not found in: /project');
    });

    it('should display config as JSON when found', async () => {
      command.setAction('show');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      const { logger } = await import('../utils/logger');
      const logSpy = jest.spyOn(logger, 'log');

      await command['run']();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('my-app'));

      logSpy.mockRestore();
    });
  });

  describe('setConfig', () => {
    it('should set the value through the config service', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'false');
      mockedSetConfigValue.mockResolvedValue({ previous: true, next: false });

      await command['run']();

      expect(mockedSetConfigValue).toHaveBeenCalledWith(
        expect.any(String),
        'platforms.ios.enabled',
        'false'
      );
    });

    it('should throw when key is missing', async () => {
      command.setAction('set');

      await expect(command['run']()).rejects.toThrow('Key and value are required');
    });

    it('should throw when value is undefined', async () => {
      command.setAction('set');
      command.setKeyValue('name');

      await expect(command['run']()).rejects.toThrow('Key and value are required');
    });

    it('should include previous value in success message when overwriting', async () => {
      command.setAction('set');
      command.setKeyValue('name', 'renamed-app');
      mockedSetConfigValue.mockResolvedValue({ previous: 'my-app', next: 'renamed-app' });

      await command['run']();

      expect(logger.success).toHaveBeenCalledWith('Set name = renamed-app (was: "my-app")');
    });

    it('should omit previous value in success message when key has no prior value', async () => {
      command.setAction('set');
      command.setKeyValue('displayName', 'My App');
      mockedSetConfigValue.mockResolvedValue({ previous: undefined, next: 'My App' });

      await command['run']();

      expect(logger.success).toHaveBeenCalledWith('Set displayName = My App');
    });

    it('should not report success when the config service refuses the value', async () => {
      command.setAction('set');
      command.setKeyValue('displayName', '');
      mockedSetConfigValue.mockRejectedValue(new Error("'displayName' must be a non-empty string"));

      await expect(command['run']()).rejects.toThrow('must be a non-empty string');
      expect(logger.success).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should throw when key is not provided', async () => {
      command.setAction('get');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await expect(command['run']()).rejects.toThrow('Key is required');
    });

    it('should get a top-level value', async () => {
      command.setAction('get');
      command.setKeyValue('name');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('my-app'));
    });

    it('should get a nested value', async () => {
      command.setAction('get');
      command.setKeyValue('platforms.android.packageName');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('com.example.myapp'));
    });

    it('should throw for missing key path', async () => {
      command.setAction('get');
      command.setKeyValue('nonexistent.key');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await expect(command['run']()).rejects.toThrow('Configuration key not found');
    });

    it('should throw GyoError when config not found on get', async () => {
      command.setAction('get');
      command.setKeyValue('name');
      mockedLoadConfig.mockRejectedValue(new Error('gyo.config.json not found in: /project'));

      await expect(command['run']()).rejects.toThrow('gyo.config.json not found in: /project');
    });
  });
});
