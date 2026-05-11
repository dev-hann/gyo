import { PhoneCaller } from '../PhoneCaller';
import type { CallLogResult } from '../types';

describe('PhoneCaller', () => {
  let caller: PhoneCaller;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    caller = new PhoneCaller();
  });

  afterEach(() => {
    caller.destroy();
  });

  describe('constructor', () => {
    it('should create instance with phone_caller bridge name', () => {
      expect(caller).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(caller.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(caller.isAvailable()).toBe(true);
    });
  });

  describe('call', () => {
    it('should invoke call with phoneNumber', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (caller as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await caller.call({ phoneNumber: '01012345678' });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('call', {
        phoneNumber: '01012345678',
      });
    });

    it('should return false when call fails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (caller as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await caller.call({ phoneNumber: '' });

      expect(result).toBe(false);
    });
  });

  describe('getCallLog', () => {
    it('should invoke get_call_log with limit and return entries', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: CallLogResult = {
        entries: [
          {
            number: '01012345678',
            name: 'John',
            date: 1700000000000,
            duration: 120,
            type: 'OUTGOING',
          },
          {
            number: '01098765432',
            name: 'Jane',
            date: 1700000001000,
            duration: 60,
            type: 'INCOMING',
          },
        ],
        count: 2,
      };

      const invokeSpy = jest.spyOn(
        (caller as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await caller.getCallLog({ limit: 10 });

      expect(result).toEqual(mockResult);
      expect(result.entries).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(invokeSpy).toHaveBeenCalledWith('get_call_log', { limit: 10 });
    });

    it('should return empty list when no calls', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: CallLogResult = { entries: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (caller as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await caller.getCallLog({ limit: 5 });

      expect(result.entries).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(caller.isAvailable()).toBe(true);

      caller.destroy();

      expect(caller.isAvailable()).toBe(false);
    });
  });
});
