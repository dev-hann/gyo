import { ScreenReader } from '../ScreenReader';
import type { NodeInfo, ReadResult, ScreenReaderFindResult } from '../types';

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

/** A node the way the native side describes one. */
function node(overrides: Partial<NodeInfo> = {}): NodeInfo {
  return {
    text: '',
    contentDescription: '',
    className: 'android.widget.TextView',
    bounds: '[100,200][500,300]',
    isClickable: false,
    isEditable: false,
    children: [],
    ...overrides,
  };
}

describe('ScreenReader', () => {
  let reader: ScreenReader;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    reader = new ScreenReader();
  });

  afterEach(() => {
    reader.destroy();
  });

  it('should be available once the native bridge is', () => {
    expect(reader.isAvailable()).toBe(true);
  });

  it('should be unavailable once destroyed', () => {
    reader.destroy();

    expect(reader.isAvailable()).toBe(false);
  });

  describe('read', () => {
    it('should read the tree from the accessibility bridge', async () => {
      const tree: ReadResult = {
        root: node({
          className: 'android.widget.FrameLayout',
          bounds: '[0,0][1080,2400]',
          children: [node({ text: 'Hello' })],
        }),
        windowName: 'MainActivity',
        packageName: 'com.example.app',
      };
      const pending = reader.read();

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, tree);
      const result = await pending;

      expect(result).toEqual(tree);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'read',
        callbackId: expect.any(String),
      });
    });

    it('should read a missing tree as it comes', async () => {
      const none: ReadResult = { root: null, windowName: '', packageName: '' };
      const pending = reader.read();

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, none);
      const result = await pending;

      expect(result).toEqual(none);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'read',
        callbackId: expect.any(String),
      });
    });
  });

  describe('find', () => {
    it('should ask the accessibility bridge for the nodes that hold a text', async () => {
      const found: ScreenReaderFindResult = {
        nodes: [
          node({
            text: 'Settings',
            contentDescription: 'Settings button',
            className: 'android.widget.Button',
            bounds: '[100,500][300,600]',
            isClickable: true,
          }),
        ],
        count: 1,
      };
      const pending = reader.find({ text: 'Settings' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, found);
      const result = await pending;

      expect(result).toEqual(found);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find',
        data: { text: 'Settings' },
        callbackId: expect.any(String),
      });
    });

    it('should read an empty result as it comes', async () => {
      const none: ScreenReaderFindResult = { nodes: [], count: 0 };
      const pending = reader.find({ text: 'nonexistent' });

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, none);
      const result = await pending;

      expect(result).toEqual(none);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'find',
        data: { text: 'nonexistent' },
        callbackId: expect.any(String),
      });
    });
  });
});
