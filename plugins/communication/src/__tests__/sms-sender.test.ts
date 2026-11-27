import { SmsSender } from '../index';
import type { ReadResult } from '../index';
import { clearNativeSide, communicationRequest, handled, posted } from './helpers/native';

describe('SmsSender', () => {
  let smsSender: SmsSender;
  let postMessage: jest.Mock;

  beforeEach(() => {
    clearNativeSide();
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    smsSender = new SmsSender();
  });

  afterEach(() => {
    smsSender.destroy();
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge is present', () => {
      delete window.androidBridge;

      expect(smsSender.isAvailable()).toBe(false);
    });

    it('should return true when the Android bridge is present', () => {
      expect(smsSender.isAvailable()).toBe(true);
    });
  });

  describe('send', () => {
    it('should invoke send with the phone number and the message', async () => {
      const pending = handled(
        smsSender.send({ phoneNumber: '+821012345678', message: 'Hello from Gyo' })
      );
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, true);

      await expect(pending).resolves.toBe(true);
      expect(sent).toEqual(
        communicationRequest('send', { phoneNumber: '+821012345678', message: 'Hello from Gyo' })
      );
    });

    it('should return false when send fails', async () => {
      const pending = handled(smsSender.send({ phoneNumber: '', message: 'test' }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, false);

      await expect(pending).resolves.toBe(false);
      expect(sent).toEqual(communicationRequest('send', { phoneNumber: '', message: 'test' }));
    });
  });

  describe('read', () => {
    it('should invoke read with the limit and return the messages', async () => {
      const messages: ReadResult = {
        messages: [
          { id: '1', address: '+821012345678', body: 'Hello', date: 1700000000000, type: 'inbox' },
          { id: '2', address: '+821098765432', body: 'World', date: 1700000001000, type: 'inbox' },
        ],
        count: 2,
      };

      const pending = handled(smsSender.read({ limit: 10 }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, messages);

      const result = await pending;
      expect(sent).toEqual(communicationRequest('read', { limit: 10 }));
      expect(result).toEqual(messages);
      expect(result.messages).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should return an empty list when there are no messages', async () => {
      const pending = handled(smsSender.read({ limit: 5 }));
      await Promise.resolve();
      const sent = posted(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, { messages: [], count: 0 });

      const result = await pending;
      expect(sent).toEqual(communicationRequest('read', { limit: 5 }));
      expect(result.messages).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      expect(smsSender.isAvailable()).toBe(true);

      smsSender.destroy();

      expect(smsSender.isAvailable()).toBe(false);
    });
  });
});
