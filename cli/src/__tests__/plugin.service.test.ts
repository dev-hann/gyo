import fs from 'fs-extra';
import {
  discoverPlugins,
  syncAndroidPlugins,
  generatePluginRegistry,
  needsSync,
} from '../services/plugin.service';
import type { DiscoveredPlugin, PluginManifest } from '../services/plugin.service';

jest.mock('fs-extra', () => ({
  readdir: jest.fn(),
  copy: jest.fn(),
  readFile: jest.fn(),
  readJson: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn(),
  remove: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock('../utils/fs', () => {
  const actualFs = jest.requireMock('fs-extra');
  return {
    ensureDir: actualFs.ensureDir,
    copyDir: actualFs.copy,
    pathExists: actualFs.pathExists,
    readJson: actualFs.readJson,
    writeJson: actualFs.writeJson,
    readFile: actualFs.readFile,
    writeFile: actualFs.writeFile,
    removeDir: actualFs.remove,
    getTemplatesPath: jest.fn().mockReturnValue('/templates'),
  };
});

const mockPathExists = fs.pathExists as jest.Mock;
const mockReaddir = fs.readdir as unknown as jest.Mock;
const mockCopy = fs.copy as unknown as jest.Mock;
const mockReadJson = fs.readJson as unknown as jest.Mock;
const mockWriteFile = fs.writeFile as unknown as jest.Mock;
const mockEnsureDir = fs.ensureDir as unknown as jest.Mock;

const SAMPLE_PLUGIN: DiscoveredPlugin = {
  name: '@gyo-framework/app-launcher',
  version: '0.1.0',
  path: '/project/lib/node_modules/@gyo-framework/app-launcher',
  meta: {
    bridgeName: 'app_launcher',
    android: {
      handlerClass: 'gyo.plugins.app_launcher.AppLauncherBridge',
    },
  },
  hasAndroid: true,
  hasIOS: false,
};

describe('plugin.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverPlugins', () => {
    it('should return empty when node_modules not found', async () => {
      mockPathExists.mockResolvedValue(false);

      const result = await discoverPlugins('/project');

      expect(result).toEqual([]);
    });

    it('should discover plugins with gyo metadata', async () => {
      const scopePath = '/project/lib/node_modules/@gyo-framework';
      mockPathExists.mockImplementation((p: string) => {
        if (p === '/project/lib/node_modules') return Promise.resolve(true);
        if (p === scopePath) return Promise.resolve(true);
        if (p.includes('package.json')) return Promise.resolve(true);
        if (p.includes('android/src')) return Promise.resolve(true);
        if (p.includes('ios/Sources')) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      mockReaddir.mockResolvedValue([{ name: 'app-launcher', isDirectory: () => true }]);

      mockReadJson.mockResolvedValue({
        name: '@gyo-framework/app-launcher',
        version: '0.1.0',
        gyo: {
          bridgeName: 'app_launcher',
          android: {
            handlerClass: 'gyo.plugins.app_launcher.AppLauncherBridge',
          },
        },
      });

      const result = await discoverPlugins('/project');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('@gyo-framework/app-launcher');
      expect(result[0].meta.bridgeName).toBe('app_launcher');
      expect(result[0].hasAndroid).toBe(true);
    });

    it('should skip packages without gyo field', async () => {
      const scopePath = '/project/lib/node_modules/@gyo-framework';
      mockPathExists.mockImplementation((p: string) => {
        if (p === '/project/lib/node_modules') return Promise.resolve(true);
        if (p === scopePath) return Promise.resolve(true);
        if (p.includes('package.json')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockReaddir.mockResolvedValue([{ name: 'bridge', isDirectory: () => true }]);

      mockReadJson.mockResolvedValue({
        name: '@gyo-framework/bridge',
        version: '0.1.3',
      });

      const result = await discoverPlugins('/project');

      expect(result).toEqual([]);
    });
  });

  describe('syncAndroidPlugins', () => {
    it('should copy Kotlin files to android project', async () => {
      mockPathExists.mockResolvedValue(true);
      mockEnsureDir.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['AppLauncherBridge.kt']);
      mockCopy.mockResolvedValue(undefined);

      await syncAndroidPlugins('/project/android', [SAMPLE_PLUGIN]);

      expect(mockEnsureDir).toHaveBeenCalled();
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it('should skip plugins without android', async () => {
      const noAndroidPlugin: DiscoveredPlugin = {
        ...SAMPLE_PLUGIN,
        hasAndroid: false,
        meta: { bridgeName: 'test' },
      };

      await syncAndroidPlugins('/project/android', [noAndroidPlugin]);

      expect(mockCopy).not.toHaveBeenCalled();
    });
  });

  describe('generatePluginRegistry', () => {
    it('should generate PluginRegistry.kt with registrations', async () => {
      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await generatePluginRegistry('/project/android', [SAMPLE_PLUGIN]);

      expect(mockEnsureDir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('object PluginRegistry');
      expect(writtenContent).toContain('BridgeRegistry.register("app_launcher"');
      expect(writtenContent).toContain('AppLauncherBridge(context)');
    });

    it('should generate empty registry when no android plugins', async () => {
      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const noAndroidPlugin: DiscoveredPlugin = {
        ...SAMPLE_PLUGIN,
        hasAndroid: false,
      };

      await generatePluginRegistry('/project/android', [noAndroidPlugin]);

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('object PluginRegistry');
      expect(writtenContent).not.toContain('BridgeRegistry.register');
    });
  });

  describe('needsSync', () => {
    it('should return true when no manifest', () => {
      expect(needsSync(null, [SAMPLE_PLUGIN])).toBe(true);
    });

    it('should return false when manifest matches current', () => {
      const manifest: PluginManifest = {
        plugins: [SAMPLE_PLUGIN],
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(needsSync(manifest, [SAMPLE_PLUGIN])).toBe(false);
    });

    it('should return true when plugin count differs', () => {
      const manifest: PluginManifest = {
        plugins: [],
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(needsSync(manifest, [SAMPLE_PLUGIN])).toBe(true);
    });

    it('should return true when version differs', () => {
      const manifest: PluginManifest = {
        plugins: [{ ...SAMPLE_PLUGIN, version: '0.0.1' }],
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(needsSync(manifest, [SAMPLE_PLUGIN])).toBe(true);
    });

    it('should return true when new plugin added', () => {
      const manifest: PluginManifest = {
        plugins: [SAMPLE_PLUGIN],
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const secondPlugin: DiscoveredPlugin = {
        ...SAMPLE_PLUGIN,
        name: '@gyo-framework/screen-action',
        meta: {
          bridgeName: 'screen_action',
          android: { handlerClass: 'gyo.plugins.screen_action.ScreenActionBridge' },
        },
      };

      expect(needsSync(manifest, [SAMPLE_PLUGIN, secondPlugin])).toBe(true);
    });
  });
});
