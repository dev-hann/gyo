import { AppLauncher } from '../AppLauncher';
import type { ListAppsResult, SearchAppsResult } from '../types';

describe('AppLauncher', () => {
  let launcher: AppLauncher;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    launcher = new AppLauncher();
  });

  afterEach(() => {
    launcher.destroy();
  });

  describe('constructor', () => {
    it('should create instance with app_launcher bridge name', () => {
      expect(launcher).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(launcher.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(launcher.isAvailable()).toBe(true);
    });
  });

  describe('listApps', () => {
    it('should invoke list_apps and return apps', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ListAppsResult = {
        apps: [
          { packageName: 'com.example.app1', name: 'App 1' },
          { packageName: 'com.example.app2', name: 'App 2' },
        ],
        count: 2,
      };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await launcher.listApps();

      expect(result).toEqual(mockResult);
      expect(result.apps).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(invokeSpy).toHaveBeenCalledWith('list_apps');
    });

    it('should return empty list when no apps', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ListAppsResult = { apps: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await launcher.listApps();

      expect(result.apps).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('openApp', () => {
    it('should invoke open_app with packageName', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await launcher.openApp({ packageName: 'com.example.app' });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('open_app', {
        packageName: 'com.example.app',
      });
    });

    it('should return false when app not found', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await launcher.openApp({
        packageName: 'com.nonexistent.app',
      });

      expect(result).toBe(false);
    });
  });

  describe('openUrl', () => {
    it('should invoke open_url with url', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await launcher.openUrl({ url: 'https://example.com' });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('open_url', {
        url: 'https://example.com',
      });
    });

    it('should return false when url invalid', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await launcher.openUrl({ url: '' });

      expect(result).toBe(false);
    });
  });

  describe('searchApps', () => {
    it('should invoke search_apps with query', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: SearchAppsResult = {
        apps: [{ packageName: 'com.example.chrome', name: 'Chrome' }],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await launcher.searchApps({ query: 'chrome' });

      expect(result).toEqual(mockResult);
      expect(invokeSpy).toHaveBeenCalledWith('search_apps', {
        query: 'chrome',
      });
    });

    it('should return empty result when no match', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: SearchAppsResult = { apps: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (launcher as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await launcher.searchApps({ query: 'nonexistent' });

      expect(result.apps).toHaveLength(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(launcher.isAvailable()).toBe(true);

      launcher.destroy();

      expect(launcher.isAvailable()).toBe(false);
    });
  });
});
