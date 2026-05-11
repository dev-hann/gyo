import { DeviceInfo } from '../DeviceInfo';
import type { GetInfoResult } from '../types';

describe('DeviceInfo', () => {
  let deviceInfo: DeviceInfo;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    deviceInfo = new DeviceInfo();
  });

  afterEach(() => {
    deviceInfo.destroy();
  });

  describe('constructor', () => {
    it('should create instance with device_info bridge name', () => {
      expect(deviceInfo).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(deviceInfo.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(deviceInfo.isAvailable()).toBe(true);
    });
  });

  describe('getInfo', () => {
    it('should invoke get_info and return device info', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: GetInfoResult = {
        info: {
          manufacturer: 'Samsung',
          model: 'Galaxy S24',
          brand: 'samsung',
          device: 'e1q',
          androidVersion: '14',
          sdkVersion: 34,
          securityPatch: '2024-12-01',
          screenDensity: 480,
          screenWidth: 1080,
          screenHeight: 2340,
          batteryLevel: 85,
          isCharging: true,
        },
      };

      const invokeSpy = jest.spyOn(
        (deviceInfo as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await deviceInfo.getInfo();

      expect(result).toEqual(mockResult);
      expect(result.info.manufacturer).toBe('Samsung');
      expect(result.info.model).toBe('Galaxy S24');
      expect(result.info.androidVersion).toBe('14');
      expect(result.info.sdkVersion).toBe(34);
      expect(result.info.batteryLevel).toBe(85);
      expect(result.info.isCharging).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('get_info');
    });

    it('should return info with default values', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: GetInfoResult = {
        info: {
          manufacturer: 'Google',
          model: 'Pixel 8',
          brand: 'google',
          device: 'shiba',
          androidVersion: '15',
          sdkVersion: 35,
          securityPatch: '2025-01-05',
          screenDensity: 420,
          screenWidth: 1080,
          screenHeight: 2400,
          batteryLevel: 50,
          isCharging: false,
        },
      };

      const invokeSpy = jest.spyOn(
        (deviceInfo as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await deviceInfo.getInfo();

      expect(result.info.batteryLevel).toBe(50);
      expect(result.info.isCharging).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(deviceInfo.isAvailable()).toBe(true);

      deviceInfo.destroy();

      expect(deviceInfo.isAvailable()).toBe(false);
    });
  });
});
