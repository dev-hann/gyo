import { Http, base64ToBytes, decodeText } from '../index';
import type { HttpResponse } from '../types';

interface BridgeMessage {
  bridgeName: string;
  methodName: string;
  data: Record<string, unknown>;
  callbackId: string;
}

/** What was posted to the native side, once the bridge has had a turn to send it. */
async function postedMessage(postMessage: jest.Mock): Promise<BridgeMessage> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const raw = postMessage.mock.calls[0]?.[0] as string | undefined;
  if (raw === undefined) {
    throw new Error('nothing was posted to the native bridge');
  }
  return JSON.parse(raw) as BridgeMessage;
}

const response = (bodyBase64: string): HttpResponse => ({
  status: 200,
  url: 'https://example.com/',
  headers: { 'content-type': 'text/html' },
  bodyBase64,
});

describe('Http', () => {
  let http: Http;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    http = new Http();
  });

  afterEach(() => {
    http.destroy();
    jest.useRealTimers();
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge is present', () => {
      expect(http.isAvailable()).toBe(false);
    });

    it('should return true when the Android bridge is present', () => {
      window.androidBridge = { postMessage };

      expect(http.isAvailable()).toBe(true);
    });
  });

  describe('request', () => {
    it('should post the url, headers and jar to the http bridge and resolve with the native result', async () => {
      window.androidBridge = { postMessage };
      const native = response('6rCA');

      const pending = http.request({
        url: 'https://example.com/list?page=1',
        headers: { 'User-Agent': 'ua/1.0', Referer: 'https://example.com/' },
        jar: 'example',
      });
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, native);

      await expect(pending).resolves.toEqual(native);
      expect(sent).toMatchObject({
        bridgeName: 'http',
        methodName: 'request',
        data: {
          url: 'https://example.com/list?page=1',
          headers: { 'User-Agent': 'ua/1.0', Referer: 'https://example.com/' },
          jar: 'example',
        },
      });
    });

    it('should send the url alone when no headers or jar are given', async () => {
      window.androidBridge = { postMessage };

      http.request({ url: 'https://example.com/' });
      const sent = await postedMessage(postMessage);

      expect(sent.data).toEqual({ url: 'https://example.com/' });
    });

    it('should reject with the message of the native side when the request fails there', async () => {
      window.androidBridge = { postMessage };

      const pending = http.request({ url: 'https://example.com/' });
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.reject(sent.callbackId, 'timeout');

      await expect(pending).rejects.toThrow('timeout');
    });

    it('should reject when there is no native bridge', async () => {
      await expect(http.request({ url: 'https://example.com/' })).rejects.toThrow(
        'No native bridge found'
      );
    });

    it('should reject once destroyed', async () => {
      window.androidBridge = { postMessage };
      http.destroy();

      expect(http.isAvailable()).toBe(false);
      await expect(http.request({ url: 'https://example.com/' })).rejects.toThrow(
        'Bridge has been destroyed'
      );
    });

    it('should give up after 60 seconds without an answer', async () => {
      jest.useFakeTimers();
      window.androidBridge = { postMessage };

      const pending = http.request({ url: 'https://example.com/' });
      const rejection = expect(pending).rejects.toThrow(
        "Bridge method 'request' timed out after 60000ms"
      );
      await jest.advanceTimersByTimeAsync(60_000);

      await rejection;
    });
  });
});

describe('base64ToBytes', () => {
  it('should turn base64 into the raw bytes', () => {
    expect(Array.from(base64ToBytes('6rCA'))).toEqual([0xea, 0xb0, 0x80]);
  });
});

describe('decodeText', () => {
  it('should decode UTF-8 by default', () => {
    expect(decodeText(response('6rCA'))).toBe('가');
  });

  it('should decode with the charset the caller names', () => {
    expect(decodeText(response('sKE='), 'euc-kr')).toBe('가');
  });

  it('should turn malformed bytes into U+FFFD instead of failing the page', () => {
    expect(decodeText(response('////'))).toBe('\uFFFD\uFFFD\uFFFD');
  });
});
