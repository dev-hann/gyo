import { NotificationReader } from '../NotificationReader';
import type { ListResult } from '../types';

describe('NotificationReader', () => {
  let reader: NotificationReader;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    reader = new NotificationReader();
  });

  afterEach(() => {
    reader.destroy();
  });

  describe('constructor', () => {
    it('should create instance with notification_reader bridge name', () => {
      expect(reader).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(reader.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(reader.isAvailable()).toBe(true);
    });
  });

  describe('list', () => {
    it('should invoke list and return notifications', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ListResult = {
        notifications: [
          {
            packageName: 'com.whatsapp',
            title: 'John',
            text: 'Hello there!',
            postTime: 1700000000000,
            category: 'msg',
          },
          {
            packageName: 'com.google.gm',
            title: 'Meeting Update',
            text: 'The meeting has been rescheduled',
            postTime: 1700000001000,
            category: 'email',
          },
        ],
        count: 2,
      };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.list();

      expect(result).toEqual(mockResult);
      expect(result.notifications).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(invokeSpy).toHaveBeenCalledWith('list');
    });

    it('should return empty list when no notifications', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ListResult = { notifications: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.list();

      expect(result.notifications).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should return single notification correctly', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ListResult = {
        notifications: [
          {
            packageName: 'com.example.app',
            title: 'Test',
            text: 'Test notification',
            postTime: 1700000000000,
            category: 'social',
          },
        ],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.list();

      expect(result.notifications[0].packageName).toBe('com.example.app');
      expect(result.notifications[0].title).toBe('Test');
      expect(result.notifications[0].text).toBe('Test notification');
      expect(result.count).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(reader.isAvailable()).toBe(true);

      reader.destroy();

      expect(reader.isAvailable()).toBe(false);
    });
  });
});
