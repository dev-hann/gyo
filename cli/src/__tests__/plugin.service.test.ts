import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import {
  discoverPlugins,
  needsSync,
  readManifest,
  syncAndroidPlugins,
  syncAndroidPluginsIfNeeded,
} from '../services/plugin.service';
import type { DiscoveredPlugin, PluginManifest } from '../services/plugin.service';
import type { PluginFixtureOptions } from './helpers/plugin';
import {
  APP_LAUNCHER_HANDLER,
  SMS_SENDER_HANDLER,
  androidFilePath,
  writeAndroidShell,
  writePluginFixture,
} from './helpers/plugin';
import { logger } from '../utils/logger';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setVerbose: jest.fn(),
  },
}));

// The tests run against a real temporary project laid out like one `gyo
// create` writes: mocked paths are what let the wrong source layout pass
// here while every published plugin failed.
const GENERATED_FILES = ['gyo.settings.gradle', 'app/gyo.build.gradle'];
const REGISTRY = 'app/src/main/java/gyo/plugins/bridge/PluginRegistry.kt';
const APP_LAUNCHER = '@gyo-framework/app-launcher';
const SMS_SENDER = '@gyo-framework/sms-sender';
const PACKAGE_NAME = 'com.example.app';

describe('plugin.service', () => {
  let projectPath: string;

  const addPlugin = (
    name: string,
    handlerClass: string,
    bridgeName: string,
    options?: PluginFixtureOptions
  ): DiscoveredPlugin => writePluginFixture(projectPath, name, handlerClass, bridgeName, options);

  const readAndroid = (...relativePath: string[]): string =>
    fs.readFileSync(androidFilePath(projectPath, ...relativePath), 'utf-8');

  beforeEach(() => {
    jest.clearAllMocks();
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-plugin-service-'));
    writeAndroidShell(projectPath, PACKAGE_NAME);
  });

  afterEach(() => {
    fs.removeSync(projectPath);
  });

  describe('discoverPlugins', () => {
    it('should return no plugins when lib/ has no node_modules', async () => {
      const result = await discoverPlugins(projectPath);

      expect(result).toEqual([]);
    });

    it('should discover a plugin that declares a gyo field', async () => {
      addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      const result = await discoverPlugins(projectPath);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: APP_LAUNCHER,
        version: '0.1.0',
        meta: { bridgeName: 'app_launcher', android: { handlerClass: APP_LAUNCHER_HANDLER } },
        hasAndroid: true,
        hasIOS: false,
      });
    });

    it('should discover a plugin that node_modules keeps as a symlink', async () => {
      // npm link, pnpm and workspaces all install packages as symlinks.
      const store = path.join(projectPath, 'store');
      const plugin = writePluginFixture(store, APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      fs.ensureSymlinkSync(
        plugin.path,
        path.join(projectPath, 'lib', 'node_modules', ...APP_LAUNCHER.split('/'))
      );

      const result = await discoverPlugins(projectPath);

      expect(result.map((found) => found.name)).toEqual([APP_LAUNCHER]);
    });

    it('should skip packages without a gyo field', async () => {
      fs.outputJsonSync(
        path.join(projectPath, 'lib/node_modules/@gyo-framework/bridge/package.json'),
        { name: '@gyo-framework/bridge', version: '0.1.3' }
      );

      const result = await discoverPlugins(projectPath);

      expect(result).toEqual([]);
    });
  });

  describe('syncAndroidPlugins', () => {
    it('should include each plugin as a Gradle module from where node_modules keeps it', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await syncAndroidPlugins(projectPath, [plugin]);

      const settings = readAndroid('gyo.settings.gradle');
      expect(settings).toContain("include ':gyo-plugin-app-launcher'");
      expect(settings).toContain(
        "project(':gyo-plugin-app-launcher').projectDir = file('../lib/node_modules/@gyo-framework/app-launcher/android')"
      );
    });

    it('should follow a symlinked package to its real directory', async () => {
      const store = path.join(projectPath, 'store');
      const plugin = writePluginFixture(store, APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      fs.ensureSymlinkSync(
        plugin.path,
        path.join(projectPath, 'lib', 'node_modules', ...APP_LAUNCHER.split('/'))
      );

      await syncAndroidPlugins(projectPath, [plugin]);

      expect(readAndroid('gyo.settings.gradle')).toContain(
        "projectDir = file('../store/lib/node_modules/@gyo-framework/app-launcher/android')"
      );
    });

    it('should make the app depend on every plugin module', async () => {
      const plugins = [
        addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher'),
        addPlugin(SMS_SENDER, SMS_SENDER_HANDLER, 'sms_sender'),
      ];

      await syncAndroidPlugins(projectPath, plugins);

      const appGradle = readAndroid('app/gyo.build.gradle');
      expect(appGradle).toContain("implementation project(':gyo-plugin-app-launcher')");
      expect(appGradle).toContain("implementation project(':gyo-plugin-sms-sender')");
    });

    it('should write a registry that registers every handler', async () => {
      const plugins = [
        addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher'),
        addPlugin(SMS_SENDER, SMS_SENDER_HANDLER, 'sms_sender'),
      ];

      await syncAndroidPlugins(projectPath, plugins);

      const registry = readAndroid(REGISTRY);
      expect(registry).toContain(`import ${APP_LAUNCHER_HANDLER}`);
      expect(registry).toContain(
        'BridgeRegistry.register("app_launcher", AppLauncherBridge(context))'
      );
      expect(registry).toContain('BridgeRegistry.register("sms_sender", SmsSenderBridge(context))');
    });

    it('should leave the shell as the template ships it when no plugin is installed', async () => {
      const before = [...GENERATED_FILES, REGISTRY].map((file) => readAndroid(file));

      await syncAndroidPlugins(projectPath, []);

      expect([...GENERATED_FILES, REGISTRY].map((file) => readAndroid(file))).toEqual(before);
    });

    it('should fail when a plugin has sources but no Gradle module', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher', {
        module: false,
      });

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow(
        'no android/build.gradle'
      );
    });

    it('should fail when two plugins are included as the same Gradle project', async () => {
      const plugins = [
        addPlugin('@gyo-framework/sms-sender', SMS_SENDER_HANDLER, 'sms_sender'),
        // A dot is not allowed in a Gradle project name; both become sms-sender.
        addPlugin('@gyo-community/sms.sender', SMS_SENDER_HANDLER, 'sms_sender'),
      ];

      await expect(syncAndroidPlugins(projectPath, plugins)).rejects.toThrow(
        'Two plugins are included as :gyo-plugin-sms-sender'
      );
    });

    it('should fail when the Android shell predates plugin modules', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      fs.removeSync(androidFilePath(projectPath, 'gyo-bridge/build.gradle'));

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow(
        'predates plugin modules'
      );
    });

    it('should fail when the Gradle files that include the plugins are not applied', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      fs.writeFileSync(
        androidFilePath(projectPath, 'settings.gradle'),
        readAndroid('settings.gradle').replace("apply from: 'gyo.settings.gradle'", '')
      );

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow(
        'settings.gradle must apply'
      );
    });

    it('should fail when a file in the app duplicates a handler class', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      fs.outputFileSync(
        androidFilePath(
          projectPath,
          'app/src/main/java/gyo/plugins/app_launcher/AppLauncherBridge.kt'
        ),
        'class AppLauncherBridge\n'
      );

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow('duplicate classes');
    });

    it('should remove the sources an earlier gyo copied into the app', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      // A sync record without a model was written before plugins were modules.
      fs.outputJsonSync(path.join(projectPath, '.gyo-plugins'), { plugins: [plugin] });
      const copied = androidFilePath(
        projectPath,
        'app/src/main/java/gyo/plugins/app_launcher/AppLauncherBridge.kt'
      );
      fs.outputFileSync(copied, 'class AppLauncherBridge\n');

      await syncAndroidPlugins(projectPath, [plugin]);

      expect(fs.existsSync(path.dirname(copied))).toBe(false);
    });

    it('should point out run-time permissions the app does not declare', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher', {
        permissions: ['android.permission.READ_CONTACTS'],
      });

      await syncAndroidPlugins(projectPath, [plugin]);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('android.permission.READ_CONTACTS')
      );
    });

    it('should stay quiet about permissions the app declares', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher', {
        permissions: ['android.permission.INTERNET'],
      });

      await syncAndroidPlugins(projectPath, [plugin]);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should record the model and paths relative to the project', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await syncAndroidPlugins(projectPath, [plugin]);

      const manifest = await readManifest(projectPath);
      expect(manifest?.model).toBe('gradle-module');
      expect(manifest?.plugins[0].path).toBe('lib/node_modules/@gyo-framework/app-launcher');
    });

    it('should fail when the project has no android directory', async () => {
      fs.removeSync(androidFilePath(projectPath));

      await expect(syncAndroidPlugins(projectPath, [])).rejects.toThrow(
        'Android project not found'
      );
    });
  });

  describe('syncAndroidPluginsIfNeeded', () => {
    it('should leave the project alone when nothing changed', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      await syncAndroidPlugins(projectPath, [plugin]);
      fs.writeFileSync(androidFilePath(projectPath, REGISTRY), 'edited by hand\n');

      await syncAndroidPluginsIfNeeded(projectPath);

      expect(readAndroid(REGISTRY)).toBe('edited by hand\n');
    });

    it('should sync a plugin installed since the last sync', async () => {
      await syncAndroidPluginsIfNeeded(projectPath);

      addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      await syncAndroidPluginsIfNeeded(projectPath);

      expect(readAndroid(REGISTRY)).toContain('BridgeRegistry.register("app_launcher"');
    });
  });
});

describe('needsSync', () => {
  const plugin: DiscoveredPlugin = {
    name: '@gyo-framework/app-launcher',
    version: '0.1.0',
    path: '/project/lib/node_modules/@gyo-framework/app-launcher',
    meta: { bridgeName: 'app_launcher', android: { handlerClass: APP_LAUNCHER_HANDLER } },
    hasAndroid: true,
    hasIOS: false,
  };
  const manifestWith = (...plugins: DiscoveredPlugin[]): PluginManifest => ({
    model: 'gradle-module',
    plugins,
  });

  it('should return true when there is no manifest', () => {
    expect(needsSync(null, [plugin])).toBe(true);
  });

  it('should return true for a manifest written before plugins were modules', () => {
    expect(needsSync({ plugins: [plugin] }, [plugin])).toBe(true);
  });

  it('should return false when the manifest matches the installed plugins', () => {
    expect(needsSync(manifestWith(plugin), [plugin])).toBe(false);
  });

  it('should return true when a plugin was added or removed', () => {
    expect(needsSync(manifestWith(), [plugin])).toBe(true);
    expect(needsSync(manifestWith(plugin), [])).toBe(true);
  });

  it('should return true when a plugin has a new version or another platform', () => {
    expect(needsSync(manifestWith(plugin), [{ ...plugin, version: '0.2.0' }])).toBe(true);
    expect(needsSync(manifestWith(plugin), [{ ...plugin, hasIOS: true }])).toBe(true);
  });
});
