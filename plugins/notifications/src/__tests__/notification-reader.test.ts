import { NotificationReader } from '../NotificationReader';
import type { ListResult } from '../types';

/** What one call posted to the native side. */
interface Posted {
  bridgeName: string;
  methodName: string;
  data: Record<string, unknown>;
  callbackId: string;
}

/** A call together with what it posted and what it resolved with. */
interface Exchange<T> {
  request: Posted;
  result: T;
}

/**
 * Runs a call, answers whatever it posted with `answer`, and returns both. The
 * answer goes out before a test asserts on the request: a wrong request then
 * fails on its own instead of leaving a call that `destroy()` rejects.
 */
async function exchange<T>(call: () => Promise<T>, answer: T): Promise<Exchange<T>> {
  const pending = call();
  await Promise.resolve(); // the Bridge posts on the next microtasks
  const raw = (window.androidBridge!.postMessage as jest.Mock).mock.calls[0][0] as string;
  const request = JSON.parse(raw) as Posted;
  window.gyoBridge!.resolve(request.callbackId, answer);
  return { request, result: await pending };
}

describe('NotificationReader', () => {
  let reader: NotificationReader;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    reader = new NotificationReader();
  });

  afterEach(() => {
    reader.destroy();
  });

  it('should return false when no native bridge present', () => {
    expect(reader.isAvailable()).toBe(false);
  });

  it('should return true when Android bridge present', () => {
    window.androidBridge = { postMessage };

    expect(reader.isAvailable()).toBe(true);
  });

  it('should ask the notifications bridge for the list and resolve with what it answers', async () => {
    window.androidBridge = { postMessage };
    const list: ListResult = {
      notifications: [
        {
          packageName: 'com.whatsapp',
          title: 'John',
          text: 'Hello there!',
          postTime: 1700000000000,
          category: 'msg',
          id: 7,
        },
        {
          packageName: 'com.google.gm',
          title: 'Meeting Update',
          text: 'The meeting has been rescheduled',
          postTime: 1700000001000,
          category: 'email',
          id: 8,
        },
      ],
      count: 2,
    };

    const { request, result } = await exchange(() => reader.list(), list);

    expect(request).toEqual({
      bridgeName: 'notifications',
      methodName: 'list',
      callbackId: expect.any(String),
    });
    expect(result).toEqual(list);
  });

  it('should resolve with an empty result when no notification is active', async () => {
    window.androidBridge = { postMessage };
    const empty: ListResult = { notifications: [], count: 0 };

    const { result } = await exchange(() => reader.list(), empty);

    expect(result).toEqual(empty);
  });

  it('should clean up bridge on destroy', () => {
    window.androidBridge = { postMessage };
    expect(reader.isAvailable()).toBe(true);

    reader.destroy();

    expect(reader.isAvailable()).toBe(false);
  });
});
