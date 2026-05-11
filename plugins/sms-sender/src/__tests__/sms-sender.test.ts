import { SmsSender } from '../SmsSender';
import type { ReadResult } from '../types';

describe('SmsSender', () => {
  let smsSender: SmsSender;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    smsSender = new SmsSender();
  });

  afterEach(() => {
    smsSender.destroy();
  });

  describe('constructor', () => {
    it('should create instance with sms_sender bridge name', () => {
      expect(smsSender).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(smsSender.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(smsSender.isAvailable()).toBe(true);
    });
  });

  describe('send', () => {
    it('should invoke send with phoneNumber and message', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (smsSender as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await smsSender.send({
        phoneNumber: '+821012345678',
        message: 'Hello from AIOS',
      });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('send', {
        phoneNumber: '+821012345678',
        message: 'Hello from AIOS',
      });
    });

    it('should return false when send fails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (smsSender as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await smsSender.send({
        phoneNumber: '',
        message: 'test',
      });

      expect(result).toBe(false);
    });
  });

  describe('read', () => {
    it('should invoke read with limit and return messages', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ReadResult = {
        messages: [
          {
            id: '1',
            address: '+821012345678',
            body: 'Hello',
            date: 1700000000000,
            type: 'inbox',
          },
          {
            id: '2',
            address: '+821098765432',
            body: 'World',
            date: 1700000001000,
            type: 'inbox',
          },
        ],
        count: 2,
      };

      const invokeSpy = jest.spyOn(
        (smsSender as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await smsSender.read({ limit: 10 });

      expect(result).toEqual(mockResult);
      expect(result.messages).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(invokeSpy).toHaveBeenCalledWith('read', { limit: 10 });
    });

    it('should return empty list when no messages', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ReadResult = { messages: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (smsSender as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await smsSender.read({ limit: 5 });

      expect(result.messages).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(smsSender.isAvailable()).toBe(true);

      smsSender.destroy();

      expect(smsSender.isAvailable()).toBe(false);
    });
  });
});
