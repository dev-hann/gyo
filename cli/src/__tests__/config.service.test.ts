import {
  loadConfig,
  saveConfig,
  setConfigValue,
  shouldStartLocalServer,
  validateConfig,
} from '../services/config.service';
import type { GyoConfig } from '../core/index';

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setVerbose: jest.fn(),
  },
}));

import { readJson, writeJson, pathExists } from '../utils/fs';

const mockedReadJson = readJson as jest.MockedFunction<typeof readJson>;
const mockedWriteJson = writeJson as jest.MockedFunction<typeof writeJson>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;

const validConfig = {
  name: 'test-app',
  version: '1.0.0',
  platforms: {
    android: { enabled: true, packageName: 'com.test.app' },
  },
};

describe('config.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should return parsed config when file exists', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockResolvedValue(validConfig);

      const result = await loadConfig('/project');

      expect(result).toEqual(validConfig);
      expect(mockedPathExists).toHaveBeenCalledWith('/project/gyo.config.json');
      expect(mockedReadJson).toHaveBeenCalledWith('/project/gyo.config.json');
    });

    it('should throw GyoError when config file does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);

      await expect(loadConfig('/project')).rejects.toThrow(
        'gyo.config.json not found in: /project'
      );
    });

    it('should use process.cwd() as default project path', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockResolvedValue(validConfig);

      await loadConfig();

      expect(mockedPathExists).toHaveBeenCalledWith(expect.stringContaining('gyo.config.json'));
      expect(mockedReadJson).toHaveBeenCalledWith(expect.stringContaining('gyo.config.json'));
    });

    it('should throw GyoError when readJson throws', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockRejectedValue(new Error('parse error'));

      await expect(loadConfig('/project')).rejects.toThrow('Failed to load config: parse error');
    });

    it('should throw GyoError when config fails validation', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockResolvedValue({ name: 123 });

      await expect(loadConfig('/project')).rejects.toThrow('Invalid gyo.config.json:');
    });
  });

  describe('saveConfig', () => {
    it('should write config to gyo.config.json', async () => {
      mockedWriteJson.mockResolvedValue(undefined);

      await saveConfig(validConfig as GyoConfig, '/project');

      expect(mockedWriteJson).toHaveBeenCalledWith('/project/gyo.config.json', validConfig);
    });

    it('should use process.cwd() as default project path', async () => {
      mockedWriteJson.mockResolvedValue(undefined);

      await saveConfig(validConfig as GyoConfig);

      expect(mockedWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('gyo.config.json'),
        validConfig
      );
    });
  });

  describe('setConfigValue', () => {
    /** Puts a config on disk; reads hand out the same object, as the file would. */
    function configOnDisk(config: Record<string, unknown>): void {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockResolvedValue(config);
      mockedWriteJson.mockResolvedValue(undefined);
    }

    function lastSaved(): Record<string, unknown> {
      const calls = mockedWriteJson.mock.calls;
      return calls[calls.length - 1][1] as Record<string, unknown>;
    }

    it('should set a top-level value', async () => {
      configOnDisk(structuredClone(validConfig));

      const { previous, next } = await setConfigValue('/project', 'name', 'new-name');

      expect(previous).toBe('test-app');
      expect(next).toBe('new-name');
      expect(lastSaved().name).toBe('new-name');
    });

    it('should set a nested value', async () => {
      configOnDisk(structuredClone(validConfig));

      await setConfigValue('/project', 'platforms.android.packageName', 'com.new.pkg');

      expect(lastSaved().platforms).toEqual({
        android: { enabled: true, packageName: 'com.new.pkg' },
      });
    });

    it('should keep a string a string, so version 2 cannot become a number', async () => {
      configOnDisk(structuredClone(validConfig));

      await setConfigValue('/project', 'version', '2');

      expect(lastSaved().version).toBe('2');
    });

    it('should read the value as the type of the one it replaces', async () => {
      configOnDisk({
        ...structuredClone(validConfig),
        platforms: {
          android: { enabled: true, versionCode: 5 },
          ios: { enabled: true },
        },
      });

      await setConfigValue('/project', 'platforms.android.versionCode', '73');
      await setConfigValue('/project', 'platforms.ios.enabled', 'no');

      expect(lastSaved().platforms).toEqual({
        android: { enabled: true, versionCode: 73 },
        ios: { enabled: false },
      });
    });

    it('should convert the value of a new key to a number or a boolean', async () => {
      configOnDisk({
        ...structuredClone(validConfig),
        platforms: { android: { enabled: true } },
        webview: {},
      });

      await setConfigValue('/project', 'platforms.android.versionCode', '73');
      await setConfigValue('/project', 'webview.allowFileAccess', 'true');

      expect(lastSaved().platforms).toEqual({ android: { enabled: true, versionCode: 73 } });
      expect(lastSaved().webview).toEqual({ allowFileAccess: true });
    });

    it('should refuse a value that would make the config invalid', async () => {
      configOnDisk(structuredClone(validConfig));

      await expect(setConfigValue('/project', 'displayName', '')).rejects.toThrow(
        "Invalid gyo.config.json:\n  - 'displayName' must be a non-empty string"
      );
      expect(mockedWriteJson).not.toHaveBeenCalled();
    });

    it('should refuse a server URL without http or https', async () => {
      configOnDisk({
        ...structuredClone(validConfig),
        profiles: { development: { serverUrl: 'http://localhost:3000' } },
      });

      await expect(
        setConfigValue('/project', 'profiles.development.serverUrl', 'example.com')
      ).rejects.toThrow("'profiles.development.serverUrl' must be a string starting with http://");
      expect(mockedWriteJson).not.toHaveBeenCalled();
    });

    it('should repair a config that is already invalid', async () => {
      configOnDisk({ ...structuredClone(validConfig), name: 123 });

      await setConfigValue('/project', 'name', 'test-app');

      expect(lastSaved().name).toBe('test-app');
    });

    it('should reject a key that goes through a value', async () => {
      configOnDisk(structuredClone(validConfig));

      await expect(setConfigValue('/project', 'name.length', '3')).rejects.toThrow(
        'Invalid configuration key: name.length'
      );
    });

    it('should reject a key whose parent is missing', async () => {
      configOnDisk(structuredClone(validConfig));

      await expect(setConfigValue('/project', 'platforms.windows.enabled', 'true')).rejects.toThrow(
        'Invalid configuration key: platforms.windows.enabled'
      );
    });

    it('should throw when there is no config file', async () => {
      mockedPathExists.mockResolvedValue(false);

      await expect(setConfigValue('/project', 'name', 'x')).rejects.toThrow(
        'gyo.config.json not found in: /project'
      );
    });
  });

  describe('shouldStartLocalServer', () => {
    it('should return true for development profile', () => {
      expect(shouldStartLocalServer('development')).toBe(true);
    });

    it('should return false for production profile', () => {
      expect(shouldStartLocalServer('production')).toBe(false);
    });

    it('should default to development profile', () => {
      expect(shouldStartLocalServer()).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should accept a valid config', () => {
      expect(validateConfig(validConfig)).toBe(true);
    });

    it('should reject null', () => {
      expect(validateConfig(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateConfig('string')).toBe(false);
    });

    it('should reject missing name', () => {
      const noName = { ...validConfig };
      delete (noName as Record<string, unknown>).name;
      expect(validateConfig(noName)).toBe(false);
    });

    it('should reject empty name', () => {
      expect(validateConfig({ ...validConfig, name: '  ' })).toBe(false);
    });

    it('should reject missing version', () => {
      const noVersion = { ...validConfig };
      delete (noVersion as Record<string, unknown>).version;
      expect(validateConfig(noVersion)).toBe(false);
    });

    it('should reject missing platforms', () => {
      const noPlatforms = { ...validConfig };
      delete (noPlatforms as Record<string, unknown>).platforms;
      expect(validateConfig(noPlatforms)).toBe(false);
    });

    it('should accept config with valid profiles', () => {
      const config = {
        ...validConfig,
        profiles: { development: { serverUrl: 'http://dev.local' } },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject profiles with non-string serverUrl', () => {
      const config = {
        ...validConfig,
        profiles: { development: { serverUrl: 123 } },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should reject android platform with non-boolean enabled', () => {
      const config = {
        ...validConfig,
        platforms: { android: { enabled: 'yes' } },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should reject android platform with non-string packageName', () => {
      const config = {
        ...validConfig,
        platforms: { android: { enabled: true, packageName: 123 } },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should accept android platform without packageName', () => {
      const config = {
        ...validConfig,
        platforms: { android: { enabled: true } },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should accept a display name, an android version code and an icon', () => {
      const config = {
        ...validConfig,
        displayName: '킥뉴스',
        platforms: {
          android: { enabled: true, versionCode: 73, icon: './assets/icon.png' },
        },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject a display name that is not a non-empty string', () => {
      expect(validateConfig({ ...validConfig, displayName: 42 })).toBe(false);
      expect(validateConfig({ ...validConfig, displayName: '   ' })).toBe(false);
    });

    it('should reject an android version code that is not a positive integer', () => {
      for (const versionCode of ['73', 73.5, 0, -1]) {
        expect(
          validateConfig({ ...validConfig, platforms: { android: { enabled: true, versionCode } } })
        ).toBe(false);
      }
    });

    it('should reject an android icon that is not a string', () => {
      expect(
        validateConfig({ ...validConfig, platforms: { android: { enabled: true, icon: true } } })
      ).toBe(false);
    });

    it('should reject ios platform with non-boolean enabled', () => {
      const config = {
        ...validConfig,
        platforms: { ios: { enabled: 1 } },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should reject ios platform with non-string bundleId', () => {
      const config = {
        ...validConfig,
        platforms: { ios: { enabled: true, bundleId: false } },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should accept ios platform without bundleId', () => {
      const config = {
        ...validConfig,
        platforms: { ios: { enabled: true } },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject android platform that is null', () => {
      const config = {
        ...validConfig,
        platforms: { android: null },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should accept config with both platforms valid', () => {
      const config = {
        ...validConfig,
        platforms: {
          android: { enabled: true, packageName: 'com.test.app' },
          ios: { enabled: false, bundleId: 'com.test.app' },
        },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should accept config with empty platforms object', () => {
      const config = {
        ...validConfig,
        platforms: {},
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject profile serverUrl without http:// or https://', () => {
      const config = {
        ...validConfig,
        profiles: { development: { serverUrl: 'bad-url' } },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should accept profile serverUrl with http://', () => {
      const config = {
        ...validConfig,
        profiles: { development: { serverUrl: 'http://dev.local' } },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should accept profile serverUrl with https://', () => {
      const config = {
        ...validConfig,
        profiles: { production: { serverUrl: 'https://prod.example.com' } },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should reject profiles when it is null', () => {
      expect(validateConfig({ ...validConfig, profiles: null })).toBe(false);
    });

    it('should reject profiles when it is a non-object string', () => {
      expect(validateConfig({ ...validConfig, profiles: 'bad' })).toBe(false);
    });

    it('should reject profile entry when it is a string', () => {
      const config = {
        ...validConfig,
        profiles: { development: 'not-an-object' },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should reject profile entry when it is null', () => {
      const config = {
        ...validConfig,
        profiles: { development: null },
      };
      expect(validateConfig(config)).toBe(false);
    });

    it('should reject platforms when it is a non-object string', () => {
      expect(validateConfig({ ...validConfig, platforms: 'bad' as any })).toBe(false);
    });
  });
});
