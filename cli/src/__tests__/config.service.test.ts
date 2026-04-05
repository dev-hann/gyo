import {
  loadConfig,
  saveConfig,
  getProfileUrl,
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
import { logger } from '../utils/logger';

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

    it('should return null when config file does not exist', async () => {
      mockedPathExists.mockResolvedValue(false);

      const result = await loadConfig('/project');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('gyo.config.json not found')
      );
    });

    it('should use process.cwd() as default project path', async () => {
      mockedPathExists.mockResolvedValue(false);

      await loadConfig();

      expect(mockedPathExists).toHaveBeenCalledWith(expect.stringContaining('gyo.config.json'));
    });

    it('should return null when readJson throws', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockRejectedValue(new Error('parse error'));

      const result = await loadConfig('/project');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load config'));
    });

    it('should return null when config fails validation', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedReadJson.mockResolvedValue({ name: 123 });

      const result = await loadConfig('/project');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Invalid gyo.config.json:');
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

  describe('getProfileUrl', () => {
    it('should return serverUrl from the specified profile', () => {
      const config = {
        ...validConfig,
        profiles: {
          development: { serverUrl: 'http://dev.local' },
          production: { serverUrl: 'https://prod.example.com' },
        },
      } as unknown as GyoConfig;

      expect(getProfileUrl(config, 'development')).toBe('http://dev.local');
    });

    it('should return production serverUrl when profile is production', () => {
      const config = {
        ...validConfig,
        profiles: {
          development: { serverUrl: 'http://dev.local' },
          production: { serverUrl: 'https://prod.example.com' },
        },
      } as unknown as GyoConfig;

      expect(getProfileUrl(config, 'production')).toBe('https://prod.example.com');
    });

    it('should use legacy serverUrl when profiles not defined', () => {
      const config = {
        ...validConfig,
        serverUrl: 'http://legacy.local',
      } as unknown as GyoConfig;

      expect(getProfileUrl(config, 'staging')).toBe('http://legacy.local');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('legacy serverUrl'));
    });

    it('should throw when profile serverUrl is empty string', () => {
      const config = {
        ...validConfig,
        profiles: {
          development: { serverUrl: '  ' },
        },
      } as unknown as GyoConfig;

      expect(() => getProfileUrl(config, 'development')).toThrow(
        "Profile 'development' serverUrl cannot be empty"
      );
    });

    it('should throw when legacy serverUrl is empty string', () => {
      const config = {
        ...validConfig,
        serverUrl: '  ',
      } as unknown as GyoConfig;

      expect(() => getProfileUrl(config, 'staging')).toThrow('serverUrl cannot be empty');
    });

    it('should throw when profile not found and no legacy serverUrl', () => {
      const config = { ...validConfig } as unknown as GyoConfig;

      expect(() => getProfileUrl(config, 'staging')).toThrow("Profile 'staging' not found");
    });

    it('should default to development profile', () => {
      const config = {
        ...validConfig,
        profiles: {
          development: { serverUrl: 'http://dev.local' },
        },
      } as unknown as GyoConfig;

      expect(getProfileUrl(config)).toBe('http://dev.local');
    });
  });

  describe('shouldStartLocalServer', () => {
    it('should return true for development profile', () => {
      expect(shouldStartLocalServer(validConfig as GyoConfig, 'development')).toBe(true);
    });

    it('should return false for production profile', () => {
      expect(shouldStartLocalServer(validConfig as GyoConfig, 'production')).toBe(false);
    });

    it('should default to development profile', () => {
      expect(shouldStartLocalServer(validConfig as GyoConfig)).toBe(true);
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

    it('should reject non-string serverUrl', () => {
      expect(validateConfig({ ...validConfig, serverUrl: 42 })).toBe(false);
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

    it('should reject legacy serverUrl without http:// or https://', () => {
      expect(validateConfig({ ...validConfig, serverUrl: 'ftp://bad.local' })).toBe(false);
    });

    it('should accept legacy serverUrl with http://', () => {
      expect(validateConfig({ ...validConfig, serverUrl: 'http://localhost:3000' })).toBe(true);
    });

    it('should accept legacy serverUrl with https://', () => {
      expect(validateConfig({ ...validConfig, serverUrl: 'https://prod.example.com' })).toBe(true);
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
  });
});
