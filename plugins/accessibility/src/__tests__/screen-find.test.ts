import { ScreenFind } from '../ScreenFind';
import type { ElementInfo, ScreenFindResult } from '../types';

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

/** An element the way the native side describes one. */
function element(overrides: Partial<ElementInfo> = {}): ElementInfo {
  return {
    text: '',
    contentDescription: '',
    className: 'android.widget.TextView',
    bounds: '[0,100][200,150]',
    isClickable: true,
    isFocusable: true,
    isEditable: false,
    centerX: 100,
    centerY: 125,
    ...overrides,
  };
}

describe('ScreenFind', () => {
  let finder: ScreenFind;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    finder = new ScreenFind();
  });

  afterEach(() => {
    finder.destroy();
  });

  it('should be available once the native bridge is', () => {
    expect(finder.isAvailable()).toBe(true);
  });

  it('should be unavailable once destroyed', () => {
    finder.destroy();

    expect(finder.isAvailable()).toBe(false);
  });

  describe('findByText', () => {
    it('should ask the accessibility bridge for the elements that hold a text', async () => {
      const found: ScreenFindResult = { elements: [element({ text: 'Settings' })], count: 1 };
      const pending = finder.findByText({ text: 'Settings', exact: false });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, found);
      const result = await pending;

      expect(result).toEqual(found);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find_by_text',
        data: { text: 'Settings', exact: false },
        callbackId: expect.any(String),
      });
    });

    it('should pass an exact match as asked', async () => {
      const found: ScreenFindResult = {
        elements: [
          element({
            text: 'OK',
            className: 'android.widget.Button',
            bounds: '[50,200][150,250]',
            centerY: 225,
          }),
        ],
        count: 1,
      };
      const pending = finder.findByText({ text: 'OK', exact: true });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, found);
      const result = await pending;

      expect(result).toEqual(found);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find_by_text',
        data: { text: 'OK', exact: true },
        callbackId: expect.any(String),
      });
    });

    it('should read an empty result as it comes', async () => {
      const none: ScreenFindResult = { elements: [], count: 0 };
      const pending = finder.findByText({ text: 'nonexistent', exact: true });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, none);
      const result = await pending;

      expect(result).toEqual(none);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find_by_text',
        data: { text: 'nonexistent', exact: true },
        callbackId: expect.any(String),
      });
    });
  });

  describe('findById', () => {
    it('should ask the accessibility bridge for the elements with a view ID', async () => {
      const found: ScreenFindResult = {
        elements: [
          element({
            text: 'Submit',
            contentDescription: 'Submit button',
            className: 'android.widget.Button',
            bounds: '[100,300][300,350]',
            centerX: 200,
            centerY: 325,
          }),
        ],
        count: 1,
      };
      const pending = finder.findById({ id: 'com.example:id/submit' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, found);
      const result = await pending;

      expect(result).toEqual(found);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find_by_id',
        data: { id: 'com.example:id/submit' },
        callbackId: expect.any(String),
      });
    });

    it('should read an empty result as it comes', async () => {
      const none: ScreenFindResult = { elements: [], count: 0 };
      const pending = finder.findById({ id: 'com.nonexistent:id/missing' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, none);
      const result = await pending;

      expect(result).toEqual(none);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find_by_id',
        data: { id: 'com.nonexistent:id/missing' },
        callbackId: expect.any(String),
      });
    });
  });
});
