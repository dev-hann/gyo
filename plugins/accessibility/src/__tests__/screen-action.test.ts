import { ScreenAction } from '../ScreenAction';
import type { SwipeParams } from '../types';

/** What was posted to the native side, once the bridge has had a turn to send it. */
function posted(): {
  bridgeName: string;
  methodName: string;
  data?: unknown;
  callbackId: string;
} {
  const raw = (window.androidBridge!.postMessage as jest.Mock).mock.calls[0][0] as string;
  return JSON.parse(raw);
}

describe('ScreenAction', () => {
  let action: ScreenAction;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    action = new ScreenAction();
  });

  afterEach(() => {
    action.destroy();
  });

  it('should be available once the native bridge is', () => {
    expect(action.isAvailable()).toBe(true);
  });

  it('should be unavailable once destroyed', () => {
    action.destroy();

    expect(action.isAvailable()).toBe(false);
  });

  describe('tap', () => {
    it('should ask the accessibility bridge to tap at coordinates', async () => {
      const pending = action.tap({ x: 100, y: 200 });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, true);
      const result = await pending;

      expect(result).toBe(true);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'tap',
        data: { x: 100, y: 200 },
        callbackId: expect.any(String),
      });
    });

    it('should return false when the bridge says the tap did not happen', async () => {
      const pending = action.tap({ x: -1, y: -1 });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, false);
      const result = await pending;

      expect(result).toBe(false);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'tap',
        data: { x: -1, y: -1 },
        callbackId: expect.any(String),
      });
    });
  });

  describe('type', () => {
    it('should ask the accessibility bridge to put text in the focused input', async () => {
      const pending = action.type({ text: 'hello world' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, true);
      const result = await pending;

      expect(result).toBe(true);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'type',
        data: { text: 'hello world' },
        callbackId: expect.any(String),
      });
    });

    it('should return false when the bridge says nothing was typed', async () => {
      const pending = action.type({ text: '' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, false);
      const result = await pending;

      expect(result).toBe(false);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'type',
        data: { text: '' },
        callbackId: expect.any(String),
      });
    });
  });

  describe('swipe', () => {
    it('should ask the accessibility bridge to swipe from one point to another', async () => {
      const swipe: SwipeParams = { startX: 100, startY: 500, endX: 100, endY: 200, duration: 300 };
      const pending = action.swipe(swipe);

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, true);
      const result = await pending;

      expect(result).toBe(true);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'swipe',
        data: swipe,
        callbackId: expect.any(String),
      });
    });

    it('should return false when the bridge says the swipe did not happen', async () => {
      const swipe: SwipeParams = { startX: 0, startY: 0, endX: 0, endY: 0, duration: 0 };
      const pending = action.swipe(swipe);

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, false);
      const result = await pending;

      expect(result).toBe(false);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'swipe',
        data: swipe,
        callbackId: expect.any(String),
      });
    });
  });

  describe('globalAction', () => {
    it('should ask the accessibility bridge for a global action', async () => {
      const pending = action.globalAction({ action: 'back' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, true);
      const result = await pending;

      expect(result).toBe(true);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'global',
        data: { action: 'back' },
        callbackId: expect.any(String),
      });
    });

    it('should return false when the bridge says the action is not one of its own', async () => {
      const pending = action.globalAction({ action: 'unknown_action' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, false);
      const result = await pending;

      expect(result).toBe(false);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'global',
        data: { action: 'unknown_action' },
        callbackId: expect.any(String),
      });
    });
  });
});
