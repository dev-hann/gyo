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
import {
  APP_LAUNCHER_HANDLER,
  SMS_SENDER_HANDLER,
  writeMainActivity,
  writePluginFixture,
} from './helpers/plugin';

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

const APP_LAUNCHER = '@gyo-framework/app-launcher';
const SMS_SENDER = '@gyo-framework/sms-sender';
const PACKAGE_NAME = 'com.example.app';

describe('plugin.service', () => {
  let projectPath: string;
  let androidPath: string;
  let originalActivity: string;

  const addPlugin = (name: string, handlerClass: string, bridgeName: string): DiscoveredPlugin =>
    writePluginFixture(projectPath, name, handlerClass, bridgeName);

  function readAndroid(relativePath: string): string {
    return fs.readFileSync(path.join(androidPath, relativePath), 'utf-8');
  }

  const activityRelativePath = path.join(
    'app/src/main/java',
    ...PACKAGE_NAME.split('.'),
    'MainActivity.kt'
  );
  const registryRelativePath = path.join(
    'app/src/main/java/gyo/plugins/bridge',
    'PluginRegistry.kt'
  );

  beforeEach(() => {
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-plugin-service-'));
    androidPath = path.join(projectPath, 'android');
    originalActivity = fs.readFileSync(writeMainActivity(projectPath, PACKAGE_NAME), 'utf-8');
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

    it('should skip packages without a gyo field', async () => {
      const bridgePath = path.join(projectPath, 'lib/node_modules/@gyo-framework/bridge');
      fs.outputJsonSync(path.join(bridgePath, 'package.json'), {
        name: '@gyo-framework/bridge',
        version: '0.1.3',
      });

      const result = await discoverPlugins(projectPath);

      expect(result).toEqual([]);
    });
  });

  describe('syncAndroidPlugins', () => {
    it('should copy a handler to where its package expects it', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await syncAndroidPlugins(projectPath, [plugin]);

      const copied = readAndroid('app/src/main/java/gyo/plugins/app_launcher/AppLauncherBridge.kt');
      expect(copied).toBe('class AppLauncherBridge\n');
    });

    it('should write a registry that registers every handler', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await syncAndroidPlugins(projectPath, [plugin]);

      const registry = readAndroid(registryRelativePath);
      expect(registry).toContain(`import ${APP_LAUNCHER_HANDLER}`);
      expect(registry).toContain(
        'BridgeRegistry.register("app_launcher", AppLauncherBridge(context))'
      );
    });

    it('should register several plugins', async () => {
      const plugins = [
        addPlugin(SMS_SENDER, SMS_SENDER_HANDLER, 'sms_sender'),
        addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher'),
      ];

      await syncAndroidPlugins(projectPath, plugins);

      const registry = readAndroid(registryRelativePath);
      expect(registry).toContain(
        'BridgeRegistry.register("app_launcher", AppLauncherBridge(context))'
      );
      expect(registry).toContain('BridgeRegistry.register("sms_sender", SmsSenderBridge(context))');
    });

    it('should make MainActivity run the registry', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await syncAndroidPlugins(projectPath, [plugin]);

      const activity = readAndroid(activityRelativePath);
      expect(activity).toContain('import gyo.plugins.bridge.PluginRegistry');
      expect(activity).toContain(
        'BridgeRegistry.initialize()\n        PluginRegistry.registerAll(this)'
      );
    });

    it('should replace the sources of a plugin on a new version', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      await syncAndroidPlugins(projectPath, [plugin]);

      fs.writeFileSync(
        path.join(
          plugin.path,
          'android/src/main/kotlin/gyo/plugins/app_launcher/AppLauncherBridge.kt'
        ),
        'class AppLauncherBridge // 0.2.0\n'
      );
      await syncAndroidPlugins(projectPath, [{ ...plugin, version: '0.2.0' }]);

      expect(
        readAndroid('app/src/main/java/gyo/plugins/app_launcher/AppLauncherBridge.kt')
      ).toContain('0.2.0');
    });

    it('should fail when a plugin declares a handler but ships no sources', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      fs.removeSync(path.join(plugin.path, 'android'));

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow('ships no sources');
    });

    it('should fail when the declared bridge name is not an identifier', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app launcher');

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow('as its bridge name');
    });

    it('should remove what a plugin leaves behind once it is gone', async () => {
      const appLauncher = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      const smsSender = addPlugin(SMS_SENDER, SMS_SENDER_HANDLER, 'sms_sender');
      await syncAndroidPlugins(projectPath, [appLauncher, smsSender]);

      await syncAndroidPlugins(projectPath, [smsSender]);

      expect(
        fs.pathExistsSync(path.join(androidPath, 'app/src/main/java/gyo/plugins/app_launcher'))
      ).toBe(false);
      expect(readAndroid(registryRelativePath)).not.toContain('app_launcher');
      expect(
        fs.pathExistsSync(
          path.join(androidPath, 'app/src/main/java/gyo/plugins/sms_sender/SmsSenderBridge.kt')
        )
      ).toBe(true);
      expect(readAndroid(activityRelativePath)).toContain('PluginRegistry.registerAll(this)');
    });

    it('should restore MainActivity and drop the registry once no plugin is left', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      await syncAndroidPlugins(projectPath, [plugin]);

      await syncAndroidPlugins(projectPath, []);

      expect(readAndroid(activityRelativePath)).toBe(originalActivity);
      expect(fs.pathExistsSync(path.join(androidPath, registryRelativePath))).toBe(false);
      expect(
        fs.pathExistsSync(path.join(androidPath, 'app/src/main/java/gyo/plugins/app_launcher'))
      ).toBe(false);
    });

    it('should fail when MainActivity cannot register the plugins', async () => {
      fs.writeFileSync(
        path.join(androidPath, activityRelativePath),
        originalActivity.replace('BridgeRegistry.initialize()', '')
      );
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await expect(syncAndroidPlugins(projectPath, [plugin])).rejects.toThrow(
        'register the plugins after'
      );
    });

    it('should record the synced plugins with paths relative to the project', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');

      await syncAndroidPlugins(projectPath, [plugin]);

      const manifest = await readManifest(projectPath);
      expect(manifest?.plugins).toHaveLength(1);
      expect(manifest?.plugins[0].path).toBe('lib/node_modules/@gyo-framework/app-launcher');
      expect(manifest).not.toHaveProperty('timestamp');
    });

    it('should fail when the project has no android directory', async () => {
      fs.removeSync(androidPath);

      await expect(syncAndroidPlugins(projectPath, [])).rejects.toThrow(
        'Android project not found'
      );
    });
  });

  describe('syncAndroidPluginsIfNeeded', () => {
    it('should leave the project alone when nothing changed', async () => {
      const plugin = addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      await syncAndroidPlugins(projectPath, [plugin]);
      const copied = path.join(
        androidPath,
        'app/src/main/java/gyo/plugins/app_launcher/AppLauncherBridge.kt'
      );
      fs.writeFileSync(copied, 'edited by hand\n');

      await syncAndroidPluginsIfNeeded(projectPath);

      expect(fs.readFileSync(copied, 'utf-8')).toBe('edited by hand\n');
    });

    it('should sync a plugin installed since the last sync', async () => {
      await syncAndroidPluginsIfNeeded(projectPath);

      addPlugin(APP_LAUNCHER, APP_LAUNCHER_HANDLER, 'app_launcher');
      await syncAndroidPluginsIfNeeded(projectPath);

      expect(readAndroid(activityRelativePath)).toContain('PluginRegistry.registerAll(this)');
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
  const manifestWith = (...plugins: DiscoveredPlugin[]): PluginManifest => ({ plugins });

  it('should return true when there is no manifest', () => {
    expect(needsSync(null, [plugin])).toBe(true);
  });

  it('should return false when the manifest matches the installed plugins', () => {
    expect(needsSync(manifestWith(plugin), [plugin])).toBe(false);
  });

  it('should return true when a plugin was added', () => {
    expect(needsSync(manifestWith(), [plugin])).toBe(true);
  });

  it('should return true when a plugin was removed', () => {
    expect(needsSync(manifestWith(plugin), [])).toBe(true);
  });

  it('should return true when a plugin has a new version', () => {
    expect(needsSync(manifestWith(plugin), [{ ...plugin, version: '0.2.0' }])).toBe(true);
  });

  it('should return true when a plugin gained or lost a platform', () => {
    expect(needsSync(manifestWith(plugin), [{ ...plugin, hasIOS: true }])).toBe(true);
  });
});
