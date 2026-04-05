import { ConfigCommand } from '../commands/config';

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn(),
  validateConfig: jest.fn(),
  saveConfig: jest.fn().mockResolvedValue(undefined),
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
  getTemplatesPath: jest.fn(),
}));

import { loadConfig, saveConfig } from '../services/config.service';
import { logger } from '../utils/logger';

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockedSaveConfig = saveConfig as jest.MockedFunction<typeof saveConfig>;

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

  describe('showConfig', () => {
    it('should throw GyoError when config not found', async () => {
      command.setAction('show');
      mockedLoadConfig.mockResolvedValue(null);

      await expect(command['run']()).rejects.toThrow(
        "Configuration not found. Run 'gyo create' to scaffold a project"
      );
    });

    it('should display config as JSON when found', async () => {
      command.setAction('show');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await command['run']();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('my-app'));

      logSpy.mockRestore();
    });
  });

  describe('setConfig', () => {
    it('should set a top-level value', async () => {
      command.setAction('set');
      command.setKeyValue('name', 'new-name');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      expect(mockedSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'new-name' }),
        expect.any(String)
      );
    });

    it('should set a nested value', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.android.packageName', 'com.new.pkg');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).android).toEqual(
        expect.objectContaining({ packageName: 'com.new.pkg' })
      );
    });

    it('should parse "true" as boolean true', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'true');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should parse "false" as boolean false', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'false');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should parse numeric strings as numbers', async () => {
      command.setAction('set');
      command.setKeyValue('version', '2');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(saved.version).toBe(2);
    });

    it('should throw for invalid intermediate key', async () => {
      command.setAction('set');
      command.setKeyValue('nonexistent.key', 'value');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await expect(command['run']()).rejects.toThrow('Invalid configuration key');
    });

    it('should throw when key is missing', async () => {
      command.setAction('set');

      await expect(command['run']()).rejects.toThrow('Key and value are required');
    });

    it('should throw when value is undefined', async () => {
      command.setAction('set');
      command.setKeyValue('name');

      mockedLoadConfig.mockResolvedValue(freshConfig());

      await expect(command['run']()).rejects.toThrow('Key and value are required');
    });

    it('should throw GyoError when config not found on set', async () => {
      command.setAction('set');
      command.setKeyValue('name', 'value');
      mockedLoadConfig.mockResolvedValue(null);

      await expect(command['run']()).rejects.toThrow('Configuration not found');
    });

    it('should keep empty string as string not convert to 0', async () => {
      command.setAction('set');
      command.setKeyValue('version', '');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect(saved.version).toBe('');
    });

    it('should parse "yes" as boolean true', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'yes');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should parse "on" as boolean true', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'on');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should parse "1" as boolean true', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', '1');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should parse "no" as boolean false', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'no');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should parse "0" as boolean false', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', '0');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should parse "off" as boolean false', async () => {
      command.setAction('set');
      command.setKeyValue('platforms.ios.enabled', 'off');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      const saved = mockedSaveConfig.mock.calls[0][0] as unknown as Record<string, unknown>;
      expect((saved.platforms as Record<string, unknown>).ios).toEqual(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should include previous value in success message when overwriting', async () => {
      command.setAction('set');
      command.setKeyValue('name', 'renamed-app');
      mockedLoadConfig.mockResolvedValue(freshConfig());

      await command['run']();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('(was: "my-app")'));
    });

    it('should omit previous value in success message when key has no prior value', async () => {
      const config = freshConfig();
      (config as Record<string, unknown>).newKey = undefined;
      command.setAction('set');
      command.setKeyValue('newKey', 'fresh');
      mockedLoadConfig.mockResolvedValue(config);

      await command['run']();

      expect(logger.success).toHaveBeenCalledWith(expect.not.stringContaining('(was:'));
    });

    it('should propagate error when saveConfig rejects', async () => {
      command.setAction('set');
      command.setKeyValue('name', 'new-name');
      mockedLoadConfig.mockResolvedValue(freshConfig());
      mockedSaveConfig.mockRejectedValue(new Error('disk full'));

      await expect(command['run']()).rejects.toThrow('disk full');
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
      mockedLoadConfig.mockResolvedValue(null);

      await expect(command['run']()).rejects.toThrow('Configuration not found');
    });
  });
});
