// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot
// run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import type { BaseCommand } from '../commands/base';
import { ConfigCommand } from '../commands/config';
import type { ConfigAction } from '../commands/config';
import type { GyoConfig } from '../core/index';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

describe('ConfigCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * `gyo config <action> [key] [value]`, handed over as `registerConfigCommand`
   * does: the action, then the key and the value.
   */
  function config(action: ConfigAction, ...args: string[]): Promise<void> {
    const command = new ConfigCommand();
    command.setAction(action);
    if (action !== 'show') {
      command.setKeyValue(args[0], args[1]);
    }
    // The entry point hands every command its arguments and options as a BaseCommand.
    const entry: BaseCommand = command;
    entry.setPositionalArgs(args);
    entry.setOptions({});
    return entry.execute();
  }

  describe('getSubcommands', () => {
    it('should list show, set and get with the arguments Commander takes', () => {
      expect(ConfigCommand.getSubcommands()).toEqual([
        { name: 'show', description: 'Show current configuration' },
        { name: 'set', arguments: '<key> <value>', description: 'Set a configuration value' },
        { name: 'get', arguments: '<key>', description: 'Get a configuration value' },
      ]);
    });
  });

  describe('getMeta', () => {
    it('should name the command and say what it manages', () => {
      expect(new ConfigCommand().getMeta()).toEqual({
        name: 'config',
        description: 'Manage gyo configuration',
      });
    });
  });

  describe('in a project', () => {
    let project: TestProject;

    const configFile = (): string => project.file('gyo.config.json');
    const readConfig = (): Promise<GyoConfig> => fs.readJson(configFile());
    const readConfigText = (): string => fs.readFileSync(configFile(), 'utf-8');

    beforeEach(async () => {
      project = await createTestProject();
    });

    afterEach(() => {
      project.remove();
    });

    describe('show', () => {
      it('should print the configuration as JSON', async () => {
        await config('show');

        expect(logger.info).toHaveBeenCalledWith('Current gyo configuration:\n');
        expect(jest.mocked(logger.log)).toHaveBeenCalledTimes(1);
        const printed = jest.mocked(logger.log).mock.calls[0][0];
        expect(JSON.parse(printed)).toEqual(await readConfig());
        expect(printed).toContain('\n  "name": "demo-app"');
      });
    });

    describe('set', () => {
      it('should write the value into gyo.config.json and say what it replaced', async () => {
        const before = await readConfig();

        await config('set', 'platforms.ios.enabled', 'false');

        expect(await readConfig()).toEqual({
          ...before,
          platforms: {
            ...before.platforms,
            ios: { ...before.platforms.ios, enabled: false },
          },
        });
        expect(logger.success).toHaveBeenCalledWith(
          'Set platforms.ios.enabled = false (was: true)'
        );
      });

      it.each([
        { key: 'version', value: '2', type: 'a string', written: { version: '2' } },
        {
          key: 'platforms.android.versionCode',
          value: '73',
          type: 'a number',
          written: { platforms: { android: { versionCode: 73 } } },
        },
      ])('should read "$value" given to $key as $type', async ({ key, value, written }) => {
        await config('set', key, value);

        expect(await readConfig()).toMatchObject(written);
      });

      it('should read a new key as a boolean', async () => {
        // A project made before the setting existed has no such key.
        await project.setConfig({ webview: { allowFileAccess: false } });

        await config('set', 'webview.allowUniversalAccessFromFileURLs', 'true');

        expect(await readConfig()).toMatchObject({
          webview: { allowFileAccess: false, allowUniversalAccessFromFileURLs: true },
        });
      });

      it('should name the previous value when it overwrites one', async () => {
        await config('set', 'name', 'renamed-app');

        expect(logger.success).toHaveBeenCalledWith('Set name = renamed-app (was: "demo-app")');
        expect(await readConfig()).toMatchObject({ name: 'renamed-app' });
      });

      it('should not name a previous value when the key has none', async () => {
        await config('set', 'displayName', 'My App');

        expect(logger.success).toHaveBeenCalledWith('Set displayName = My App');
        expect(await readConfig()).toMatchObject({ displayName: 'My App' });
      });

      it.each([
        [
          'displayName',
          '',
          "Invalid gyo.config.json:\n  - 'displayName' must be a non-empty string",
        ],
        [
          'platforms.android.versionCode',
          '0',
          "Invalid gyo.config.json:\n  - 'platforms.android.versionCode' must be a positive integer",
        ],
        [
          'profiles.development.serverUrl',
          'example.com',
          "Invalid gyo.config.json:\n  - 'profiles.development.serverUrl' must be a string starting with http:// or https://",
        ],
        // The key is not created under a parent the config does not have.
        [
          'profiles.production.serverUrl',
          'https://example.com',
          'Invalid configuration key: profiles.production.serverUrl',
        ],
      ])('should refuse to set %s to "%s" and write nothing', async (key, value, error) => {
        const before = readConfigText();

        await expect(config('set', key, value)).rejects.toThrow(error);
        expect(logger.success).not.toHaveBeenCalled();
        expect(readConfigText()).toBe(before);
      });

      it('should refuse set without a key', async () => {
        await expect(config('set')).rejects.toThrow('Key and value are required for set operation');
      });

      it('should refuse set without a value', async () => {
        await expect(config('set', 'name')).rejects.toThrow(
          'Key and value are required for set operation'
        );
      });
    });

    describe('get', () => {
      it.each([
        ['name', 'name = "demo-app"'],
        ['platforms.android.packageName', 'platforms.android.packageName = "com.example.demo_app"'],
        [
          'profiles',
          'profiles = {\n  "development": {\n    "serverUrl": "http://localhost:3000"\n  }\n}',
        ],
      ])('should print the value of %s', async (key, printed) => {
        await config('get', key);

        expect(logger.info).toHaveBeenCalledWith(printed);
      });

      it('should refuse get without a key', async () => {
        await expect(config('get')).rejects.toThrow('Key is required for get operation');
      });

      it.each(['nonexistent.key', 'platforms.android.missing', 'name.length'])(
        'should say that %s is not in the configuration',
        async (key) => {
          await expect(config('get', key)).rejects.toThrow(`Configuration key not found: ${key}`);
        }
      );
    });
  });

  describe('outside a project', () => {
    let outside: string;
    let previousCwd: string;

    beforeEach(() => {
      previousCwd = process.cwd();
      outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-outside-'));
      process.chdir(outside);
    });

    afterEach(() => {
      process.chdir(previousCwd);
      fs.removeSync(outside);
    });

    it.each([
      { line: 'show', run: () => config('show') },
      { line: 'get name', run: () => config('get', 'name') },
      { line: 'set name other', run: () => config('set', 'name', 'other') },
    ])('should refuse `gyo config $line`', async ({ run }) => {
      await expect(run()).rejects.toThrow(
        `Not a gyo project (gyo.config.json not found in ${outside})`
      );

      expect(logger.error).toHaveBeenCalledWith(
        `Not a gyo project (gyo.config.json not found in ${outside}).\n  Run 'gyo create <project-name>' to create a new project.`
      );
    });
  });
});
