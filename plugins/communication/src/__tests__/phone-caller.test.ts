import { PhoneCaller } from '../index';
import type { CallLogResult } from '../index';
import { clearNativeSide, communicationRequest, handled, posted } from './helpers/native';

describe('PhoneCaller', () => {
  let caller: PhoneCaller;
  let postMessage: jest.Mock;

  beforeEach(() => {
    clearNativeSide();
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    caller = new PhoneCaller();
  });

  afterEach(() => {
    caller.destroy();
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge is present', () => {
      delete window.androidBridge;

      expect(caller.isAvailable()).toBe(false);
    });

    it('should return true when the Android bridge is present', () => {
      expect(caller.isAvailable()).toBe(true);
    });
  });

  describe('call', () => {
    it('should invoke call with the phone number', async () => {
      const pending = handled(caller.call({ phoneNumber: '01012345678' }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, true);

      await expect(pending).resolves.toBe(true);
      expect(sent).toEqual(communicationRequest('call', { phoneNumber: '01012345678' }));
    });

    it('should return false when call fails', async () => {
      const pending = handled(caller.call({ phoneNumber: '' }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, false);

      await expect(pending).resolves.toBe(false);
      expect(sent).toEqual(communicationRequest('call', { phoneNumber: '' }));
    });
  });

  describe('getCallLog', () => {
    it('should invoke get_call_log with the limit and return the entries', async () => {
      const entries: CallLogResult = {
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

      const pending = handled(caller.getCallLog({ limit: 10 }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, entries);

      const result = await pending;
      expect(sent).toEqual(communicationRequest('get_call_log', { limit: 10 }));
      expect(result).toEqual(entries);
      expect(result.entries).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should return an empty list when there are no calls', async () => {
      const pending = handled(caller.getCallLog({ limit: 5 }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, { entries: [], count: 0 });

      const result = await pending;
      expect(sent).toEqual(communicationRequest('get_call_log', { limit: 5 }));
      expect(result.entries).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      expect(caller.isAvailable()).toBe(true);

      caller.destroy();

      expect(caller.isAvailable()).toBe(false);
    });
  });
});
