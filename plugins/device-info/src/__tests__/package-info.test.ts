import { PackageInfo } from '../PackageInfo';
import type { PackageInfoResult } from '../types';

describe('PackageInfo', () => {
  let packageInfo: PackageInfo;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    packageInfo = new PackageInfo();
  });

  afterEach(() => {
    packageInfo.destroy();
  });

  describe('constructor', () => {
    it('should create instance with device_info bridge name', () => {
      expect(
        (packageInfo as unknown as { bridge: { getName: () => string } }).bridge.getName()
      ).toBe('device_info');
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(packageInfo.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(packageInfo.isAvailable()).toBe(true);
    });
  });

  describe('getInfo', () => {
    it('should invoke get_package_info and return the installed app', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const installed: PackageInfoResult = {
        packageName: 'com.keek_news.app',
        appName: '킥뉴스',
        versionName: '4.0.0',
        versionCode: 40000,
      };
      const invokeSpy = jest.spyOn(
        (packageInfo as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(installed);

      const result = await packageInfo.getInfo();

      expect(result).toEqual(installed);
      expect(invokeSpy).toHaveBeenCalledWith('get_package_info');
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(packageInfo.isAvailable()).toBe(true);

      packageInfo.destroy();

      expect(packageInfo.isAvailable()).toBe(false);
    });
  });
});
