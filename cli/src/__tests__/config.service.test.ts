import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import {
  loadConfig,
  saveConfig,
  setConfigValue,
  shouldStartLocalServer,
  validateConfig,
} from '../services/config.service';
import { GyoError } from '../core/index';
import type { GyoConfig } from '../core/index';

const validConfig = {
  name: 'test-app',
  version: '1.0.0',
  platforms: {
    android: { enabled: true, packageName: 'com.test.app' },
  },
};

// What the service reads and writes is gyo.config.json, so it runs against a
// real directory: which file it finds, and what it leaves there, is the behaviour.
describe('config.service', () => {
  let project: string;

  const configFile = (): string => path.join(project, 'gyo.config.json');
  /** Puts a config on disk, as `gyo create` or a developer leaves it. */
  const writeConfig = (config: unknown): void => {
    fs.writeJsonSync(configFile(), config, { spaces: 2 });
  };
  /** The config as the service left it on disk. */
  const readConfig = (): Promise<Record<string, unknown>> => fs.readJson(configFile());
  const readConfigText = (): string => fs.readFileSync(configFile(), 'utf-8');
  /** `validConfig` with these top-level keys replaced. */
  const configWith = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    ...validConfig,
    ...overrides,
  });

  /** Runs `action` with the project as the working directory, and returns from it after. */
  async function inProject<T>(action: () => Promise<T>): Promise<T> {
    const previousCwd = process.cwd();
    process.chdir(project);
    try {
      return await action();
    } finally {
      process.chdir(previousCwd);
    }
  }

  beforeEach(() => {
    // An empty project: a test gives it a config, or leaves it without one.
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-config-'));
  });

  afterEach(() => {
    fs.removeSync(project);
  });

  describe('loadConfig', () => {
    it('should return parsed config when file exists', async () => {
      writeConfig(validConfig);

      const config = await loadConfig(project);

      expect(config).toEqual(validConfig);
    });

    it('should throw GyoError when config file does not exist', async () => {
      const failing = loadConfig(project);

      await expect(failing).rejects.toThrow(`gyo.config.json not found in: ${project}`);
      await expect(failing).rejects.toBeInstanceOf(GyoError);
    });

    it('should use process.cwd() as default project path', async () => {
      writeConfig(validConfig);

      const config = await inProject(() => loadConfig());

      expect(config).toEqual(validConfig);
    });

    it('should throw GyoError when gyo.config.json is not valid JSON', async () => {
      fs.writeFileSync(configFile(), '{');

      const failing = loadConfig(project);

      // What went wrong follows: the file, and why the parser gave up on it.
      await expect(failing).rejects.toThrow(`Failed to load config: ${configFile()}: `);
      // What went wrong is kept as the cause.
      await expect(failing).rejects.toMatchObject({
        name: 'GyoError',
        cause: expect.any(SyntaxError),
      });
    });

    it('should throw GyoError when config fails validation', async () => {
      writeConfig({ name: 123 });

      const failing = loadConfig(project);

      await expect(failing).rejects.toThrow(
        'Invalid gyo.config.json:\n' +
          "  - 'name' must be a non-empty string\n" +
          "  - 'version' must be a non-empty string\n" +
          "  - 'platforms' must be an object"
      );
      await expect(failing).rejects.toBeInstanceOf(GyoError);
    });
  });

  describe('saveConfig', () => {
    it('should write config to gyo.config.json', async () => {
      await saveConfig(validConfig as GyoConfig, project);

      expect(await fs.readJson(configFile())).toEqual(validConfig);
    });

    it('should use process.cwd() as default project path', async () => {
      await inProject(() => saveConfig(validConfig as GyoConfig));

      expect(await fs.readJson(configFile())).toEqual(validConfig);
    });
  });

  describe('setConfigValue', () => {
    it('should set a top-level value', async () => {
      writeConfig(validConfig);

      const { previous, next } = await setConfigValue(project, 'name', 'new-name');

      expect(previous).toBe('test-app');
      expect(next).toBe('new-name');
      expect(await readConfig()).toEqual({ ...validConfig, name: 'new-name' });
    });

    it('should set a nested value', async () => {
      writeConfig(validConfig);

      await setConfigValue(project, 'platforms.android.packageName', 'com.new.pkg');

      expect(await readConfig()).toEqual({
        ...validConfig,
        platforms: { android: { enabled: true, packageName: 'com.new.pkg' } },
      });
    });

    it('should keep a string a string, so version 2 cannot become a number', async () => {
      writeConfig(validConfig);

      await setConfigValue(project, 'version', '2');

      expect(await readConfig()).toEqual({ ...validConfig, version: '2' });
    });

    it.each([
      {
        before: {
          platforms: { android: { enabled: true, versionCode: 5 }, ios: { enabled: true } },
        },
        key: 'platforms.android.versionCode',
        value: '73',
        after: {
          platforms: { android: { enabled: true, versionCode: 73 }, ios: { enabled: true } },
        },
      },
      {
        before: {
          platforms: { android: { enabled: true, versionCode: 5 }, ios: { enabled: true } },
        },
        key: 'platforms.ios.enabled',
        value: 'no',
        after: {
          platforms: { android: { enabled: true, versionCode: 5 }, ios: { enabled: false } },
        },
      },
    ])(
      'should read "$value" given to $key as the type of the value it replaces',
      async ({ before, key, value, after }) => {
        writeConfig(configWith(before));

        await setConfigValue(project, key, value);

        expect(await readConfig()).toEqual(configWith(after));
      }
    );

    it.each([
      {
        key: 'platforms.android.versionCode',
        value: '73',
        after: { platforms: { android: { enabled: true, versionCode: 73 } } },
      },
      {
        key: 'webview.allowFileAccess',
        value: 'true',
        after: { webview: { allowFileAccess: true } },
      },
    ])(
      'should read "$value" given to the new key $key as a number or a boolean',
      async ({ key, value, after }) => {
        // A project made before the setting existed has no such key.
        const before = { ...validConfig, platforms: { android: { enabled: true } }, webview: {} };
        writeConfig(before);

        const { previous } = await setConfigValue(project, key, value);

        expect(previous).toBeUndefined();
        expect(await readConfig()).toEqual({ ...before, ...after });
      }
    );

    it('should refuse a value that would make the config invalid', async () => {
      writeConfig(validConfig);
      const textBefore = readConfigText();

      const failing = setConfigValue(project, 'displayName', '');

      await expect(failing).rejects.toThrow(
        "Invalid gyo.config.json:\n  - 'displayName' must be a non-empty string"
      );
      expect(readConfigText()).toBe(textBefore);
    });

    it('should refuse a server URL without http or https', async () => {
      writeConfig(
        configWith({ profiles: { development: { serverUrl: 'http://localhost:3000' } } })
      );
      const textBefore = readConfigText();

      const failing = setConfigValue(project, 'profiles.development.serverUrl', 'example.com');

      await expect(failing).rejects.toThrow(
        "'profiles.development.serverUrl' must be a string starting with http:// or https://"
      );
      expect(readConfigText()).toBe(textBefore);
    });

    it('should repair a config that is already invalid', async () => {
      writeConfig(configWith({ name: 123 }));

      await setConfigValue(project, 'name', 'test-app');

      expect(await readConfig()).toEqual(validConfig);
    });

    it.each([
      { key: 'name.length', value: '3', where: 'goes through a value' },
      { key: 'platforms.windows.enabled', value: 'true', where: 'has no parent in the config' },
    ])('should reject a key that $where: $key', async ({ key, value }) => {
      writeConfig(validConfig);
      const textBefore = readConfigText();

      const failing = setConfigValue(project, key, value);

      await expect(failing).rejects.toThrow(`Invalid configuration key: ${key}`);
      expect(readConfigText()).toBe(textBefore);
    });

    it('should throw when there is no config file', async () => {
      await expect(setConfigValue(project, 'name', 'x')).rejects.toThrow(
        `gyo.config.json not found in: ${project}`
      );
    });

    it.each([
      ['null', null],
      ['a string', 'text'],
    ])('should refuse a gyo.config.json that holds %s', async (_shape, content) => {
      writeConfig(content);

      const failing = setConfigValue(project, 'name', 'x');

      await expect(failing).rejects.toThrow(
        'Invalid gyo.config.json:\n  - config must be a non-null object'
      );
      expect(await readConfig()).toBe(content);
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

    it('should accept ios platform without bundleId', () => {
      const config = {
        ...validConfig,
        platforms: { ios: { enabled: true } },
      };
      expect(validateConfig(config)).toBe(true);
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
      expect(validateConfig({ ...validConfig, platforms: 'bad' })).toBe(false);
    });
  });
});
