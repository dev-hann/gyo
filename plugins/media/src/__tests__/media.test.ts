import { Media } from '../index';
import type {
  MediaFailure,
  MediaFailureKind,
  SaveRequest,
  SaveResult,
  ShareResult,
} from '../types';

interface BridgeMessage {
  bridgeName: string;
  methodName: string;
  data: unknown;
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

const image: SaveRequest = {
  url: 'https://example.com/pictures/cat.jpg',
  mimeType: null,
  filename: 'cat.jpg',
  userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  folder: 'Cats',
};

const saved: SaveResult = {
  status: 'saved',
  uri: 'content://media/external/images/media/7',
  mimeType: 'image/jpeg',
};

const networkFailure: MediaFailure = { kind: 'network', message: 'The server answered 404' };

const failureKinds: MediaFailureKind[] = [
  'network',
  'unsupported',
  'permission',
  'storage',
  'canceled',
];

describe('Media', () => {
  let media: Media;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    media = new Media();
  });

  afterEach(() => {
    media.destroy();
    jest.useRealTimers();
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge is present', () => {
      expect(media.isAvailable()).toBe(false);
    });

    it('should return true when the Android bridge is present', () => {
      window.androidBridge = { postMessage };

      expect(media.isAvailable()).toBe(true);
    });
  });

  describe('saveToGallery', () => {
    it('should post the request to the media bridge and resolve with what native saved', async () => {
      window.androidBridge = { postMessage };

      const pending = media.saveToGallery(image);
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, saved);

      await expect(pending).resolves.toEqual(saved);
      expect(sent).toMatchObject({ bridgeName: 'media', methodName: 'save_to_gallery' });
      expect(sent.data).toEqual(image);
    });

    it('should send the url alone when nothing else is given', async () => {
      window.androidBridge = { postMessage };

      const pending = media.saveToGallery({ url: 'https://example.com/pictures/cat.jpg' });
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, saved);

      await expect(pending).resolves.toEqual(saved);
      expect(sent.data).toEqual({ url: 'https://example.com/pictures/cat.jpg' });
    });

    it('should keep a null mimeType apart from one that is missing', async () => {
      window.androidBridge = { postMessage };

      const pending = media.saveToGallery({
        url: 'https://example.com/pictures/cat.jpg',
        mimeType: null,
      });
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, saved);

      await expect(pending).resolves.toEqual(saved);
      expect(sent.data).toEqual({ url: 'https://example.com/pictures/cat.jpg', mimeType: null });
    });

    it('should resolve with a failure as a value instead of rejecting', async () => {
      window.androidBridge = { postMessage };

      const pending = media.saveToGallery(image);
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, { status: 'failed', error: networkFailure });

      await expect(pending).resolves.toEqual({ status: 'failed', error: networkFailure });
    });

    it.each(failureKinds)('should pass a failure of kind %s through unchanged', async (kind) => {
      window.androidBridge = { postMessage };

      const failure: SaveResult = { status: 'failed', error: { kind, message: `why ${kind}` } };
      const pending = media.saveToGallery(image);
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, failure);

      await expect(pending).resolves.toEqual(failure);
    });

    it('should reject with the message of the native side when the call fails there', async () => {
      window.androidBridge = { postMessage };

      const pending = media.saveToGallery(image);
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.reject(sent.callbackId, 'Unknown method: save_to_gallery');

      await expect(pending).rejects.toThrow('Unknown method: save_to_gallery');
    });

    it('should reject when there is no native bridge', async () => {
      await expect(media.saveToGallery(image)).rejects.toThrow('No native bridge found');
    });

    it('should reject once destroyed', async () => {
      window.androidBridge = { postMessage };
      media.destroy();

      expect(media.isAvailable()).toBe(false);
      await expect(media.saveToGallery(image)).rejects.toThrow('Bridge has been destroyed');
    });

    it('should give up after 5 minutes without an answer', async () => {
      jest.useFakeTimers();
      window.androidBridge = { postMessage };

      let settled = false;
      const pending = media.saveToGallery(image).finally(() => {
        settled = true;
      });
      const rejection = expect(pending).rejects.toThrow(
        "Bridge method 'save_to_gallery' timed out after 300000ms"
      );
      await jest.advanceTimersByTimeAsync(299_999);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);

      await rejection;
    });
  });

  describe('share', () => {
    it('should post a media request to the media bridge and resolve with shared', async () => {
      window.androidBridge = { postMessage };
      const shared: ShareResult = { status: 'shared' };

      const pending = media.share(image);
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, shared);

      await expect(pending).resolves.toEqual(shared);
      expect(sent).toMatchObject({ bridgeName: 'media', methodName: 'share' });
      expect(sent.data).toEqual(image);
    });

    it('should post a text on its own', async () => {
      window.androidBridge = { postMessage };

      const pending = media.share({ text: 'Look at this' });
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, { status: 'shared' });

      await expect(pending).resolves.toEqual({ status: 'shared' });
      expect(sent).toMatchObject({ bridgeName: 'media', methodName: 'share' });
      expect(sent.data).toEqual({ text: 'Look at this' });
    });

    it.each(failureKinds)('should resolve with a failure of kind %s as a value', async (kind) => {
      window.androidBridge = { postMessage };

      const failure: ShareResult = { status: 'failed', error: { kind, message: `why ${kind}` } };
      const pending = media.share(image);
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.resolve(sent.callbackId, failure);

      await expect(pending).resolves.toEqual(failure);
    });

    it('should reject with the message of the native side when the call fails there', async () => {
      window.androidBridge = { postMessage };

      const pending = media.share({ text: 'Look at this' });
      const sent = await postedMessage(postMessage);
      window.gyoBridge?.reject(sent.callbackId, 'Bridge has no main thread');

      await expect(pending).rejects.toThrow('Bridge has no main thread');
    });

    it('should reject when there is no native bridge', async () => {
      await expect(media.share({ text: 'Look at this' })).rejects.toThrow('No native bridge found');
    });

    it('should reject once destroyed', async () => {
      window.androidBridge = { postMessage };
      media.destroy();

      await expect(media.share(image)).rejects.toThrow('Bridge has been destroyed');
    });

    it('should give up after 5 minutes without an answer', async () => {
      jest.useFakeTimers();
      window.androidBridge = { postMessage };

      const pending = media.share({ text: 'Look at this' });
      const rejection = expect(pending).rejects.toThrow(
        "Bridge method 'share' timed out after 300000ms"
      );
      await jest.advanceTimersByTimeAsync(300_000);

      await rejection;
    });
  });

  describe('destroy', () => {
    it('should reject every call native has not answered', async () => {
      window.androidBridge = { postMessage };

      const save = media.saveToGallery(image);
      const share = media.share({ text: 'Look at this' });
      media.destroy();

      await expect(save).rejects.toThrow('Bridge has been destroyed');
      await expect(share).rejects.toThrow('Bridge has been destroyed');
    });

    it('should make destroy() idempotent', () => {
      media.destroy();

      expect(() => media.destroy()).not.toThrow();
    });
  });
});
