import type { BridgeRequest } from '@gyo-framework/bridge';
import { DownloadCancelledError, Downloader } from '../Downloader';
import type { DownloadResult } from '../types';

interface DownloadMessage extends BridgeRequest {
  methodName: 'download' | 'cancel_download';
  data: { url?: string; downloadId: string; headers?: Record<string, string>; fileName?: string };
}

/** What was posted to the native side, once the bridge has had a turn to send it. */
async function posted(postMessage: jest.Mock, count = 1): Promise<DownloadMessage[]> {
  for (let turn = 0; turn < 10 && postMessage.mock.calls.length < count; turn++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (postMessage.mock.calls.length < count) {
    throw new Error(`native was asked ${postMessage.mock.calls.length} times, not ${count}`);
  }
  return postMessage.mock.calls.map(([raw]) => JSON.parse(raw) as DownloadMessage);
}

const whole: DownloadResult = {
  path: '/data/user/0/com.example.app/cache/downloads/app.apk',
  bytesWritten: 2160183,
  status: 200,
  url: 'https://example.com/app.apk',
  headers: { 'content-type': 'application/vnd.android.package-archive' },
};

describe('Downloader', () => {
  let downloader: Downloader;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    downloader = new Downloader();
  });

  afterEach(() => {
    downloader.destroy();
  });

  describe('constructor', () => {
    it('should create instance with http bridge name', () => {
      expect(
        (downloader as unknown as { bridge: { getName: () => string } }).bridge.getName()
      ).toBe('http');
    });

    it('should give a download ten minutes before the call is cut off', () => {
      // A file is not a page: the 30 seconds of the bridge would end a slow one.
      const timeout = (downloader as unknown as { bridge: { timeout: number } }).bridge.timeout;
      expect(timeout).toBe(10 * 60 * 1000);
    });
  });

  describe('isAvailable', () => {
    it('should return true when the Android bridge is present', () => {
      expect(downloader.isAvailable()).toBe(true);
    });

    it('should return false when no native bridge is present', () => {
      delete (window as unknown as Record<string, unknown>).androidBridge;
      expect(downloader.isAvailable()).toBe(false);
    });
  });

  describe('download', () => {
    it('should post the request with a downloadId of its own', async () => {
      const first = downloader.download({
        url: 'https://example.com/app.apk',
        fileName: 'app.apk',
      });
      const second = downloader.download({ url: 'https://example.com/other.apk' });
      void first.result.catch(() => undefined);
      void second.result.catch(() => undefined);

      const messages = await posted(postMessage, 2);

      expect(messages[0]).toMatchObject({
        bridgeName: 'http',
        methodName: 'download',
        data: { url: 'https://example.com/app.apk', fileName: 'app.apk' },
      });
      expect(messages[0].data.downloadId).not.toHaveLength(0);
      expect(messages[1].data.downloadId).not.toBe(messages[0].data.downloadId);
    });

    it('should resolve with the file once native has it whole', async () => {
      const task = downloader.download({ url: whole.url });
      const [message] = await posted(postMessage);

      window.gyoBridge?.resolve(message.callbackId, whole);

      await expect(task.result).resolves.toEqual(whole);
    });

    it('should reject with what native says when the download fails', async () => {
      const task = downloader.download({ url: whole.url });
      const [message] = await posted(postMessage);

      window.gyoBridge?.reject(
        message.callbackId,
        'The server answered 404 to https://example.com/app.apk.'
      );

      await expect(task.result).rejects.toThrow('The server answered 404');
    });

    it('should give the progress of its own download to onProgress', async () => {
      const onProgress = jest.fn();
      const task = downloader.download({ url: whole.url }, { onProgress });
      const [message] = await posted(postMessage);
      const other = downloader.download({ url: 'https://example.com/other.apk' });
      void other.result.catch(() => undefined);
      await posted(postMessage, 2);

      window.gyoBridge?.publish('http', {
        type: 'progress',
        downloadId: message.data.downloadId,
        bytesWritten: 1000,
        totalBytes: 4000,
      });
      // An event of another download, and one of another shape.
      window.gyoBridge?.publish('http', {
        type: 'progress',
        downloadId: 'someone-elses',
        bytesWritten: 3000,
        totalBytes: 4000,
      });
      window.gyoBridge?.publish('http', { type: 'something-else' });

      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith({ bytesWritten: 1000, totalBytes: 4000 });

      window.gyoBridge?.resolve(message.callbackId, whole);
      await task.result;
      window.gyoBridge?.publish('http', {
        type: 'progress',
        downloadId: message.data.downloadId,
        bytesWritten: 4000,
        totalBytes: 4000,
      });
      other.cancel();
      // Once the download ended, its progress is no one's.
      expect(onProgress).toHaveBeenCalledTimes(1);
    });

    it('should do without onProgress', async () => {
      const task = downloader.download({ url: whole.url });
      const [message] = await posted(postMessage);

      window.gyoBridge?.publish('http', {
        type: 'progress',
        downloadId: message.data.downloadId,
        bytesWritten: 1,
        totalBytes: 2,
      });
      window.gyoBridge?.resolve(message.callbackId, whole);

      await expect(task.result).resolves.toEqual(whole);
    });

    it('should tell native which download to cancel', async () => {
      const task = downloader.download({ url: whole.url });
      void task.result.catch(() => undefined);
      const [download] = await posted(postMessage);

      task.cancel();
      const messages = await posted(postMessage, 2);

      expect(messages[1]).toMatchObject({
        methodName: 'cancel_download',
        data: { downloadId: download.data.downloadId },
      });
    });

    it('should reject a cancelled download as cancelled, whatever native says', async () => {
      const task = downloader.download({ url: whole.url });
      const [message] = await posted(postMessage);

      task.cancel();
      await posted(postMessage, 2);
      window.gyoBridge?.reject(message.callbackId, 'Canceled');
      const rejected = task.result.catch((error: unknown) => error);

      expect(await rejected).toBeInstanceOf(DownloadCancelledError);
      expect(await rejected).toMatchObject({ name: 'DownloadCancelledError' });
    });

    it('should cancel only once however often it is asked', async () => {
      const task = downloader.download({ url: whole.url });
      void task.result.catch(() => undefined);
      await posted(postMessage);

      task.cancel();
      task.cancel();

      const messages = await posted(postMessage, 2);
      for (let turn = 0; turn < 5; turn++) await Promise.resolve();
      expect(messages.filter((message) => message.methodName === 'cancel_download')).toHaveLength(
        1
      );
      expect(postMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('destroy', () => {
    it('should make the downloader unavailable', () => {
      expect(downloader.isAvailable()).toBe(true);

      downloader.destroy();

      expect(downloader.isAvailable()).toBe(false);
    });

    it('should reject a download native has not answered', async () => {
      const task = downloader.download({ url: whole.url });
      await posted(postMessage);

      downloader.destroy();

      await expect(task.result).rejects.toThrow('destroyed');
    });
  });
});
