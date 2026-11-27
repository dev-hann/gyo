import { NotificationListener } from '../NotificationListener';
import type { NotificationListResult, NotificationListenerStatus } from '../types';

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

describe('NotificationListener', () => {
  let listener: NotificationListener;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    listener = new NotificationListener();
  });

  afterEach(() => {
    listener.destroy();
  });

  it('should be available once the native bridge is', () => {
    expect(listener.isAvailable()).toBe(true);
  });

  it('should ask the notifications bridge whether access is granted', async () => {
    const status: NotificationListenerStatus = { enabled: false };

    const { request, result } = await exchange(() => listener.isEnabled(), status);

    expect(request).toEqual({
      bridgeName: 'notifications',
      methodName: 'is_enabled',
      callbackId: expect.any(String),
    });
    expect(result).toEqual(status);
  });

  it('should read the most recent 50 notifications by default', async () => {
    const empty: NotificationListResult = { notifications: [], count: 0 };

    const { request, result } = await exchange(() => listener.getNotifications(), empty);

    expect(request).toEqual({
      bridgeName: 'notifications',
      methodName: 'get_notifications',
      data: { limit: 50 },
      callbackId: expect.any(String),
    });
    expect(result).toEqual(empty);
  });

  it('should pass the limit it is given', async () => {
    const empty: NotificationListResult = { notifications: [], count: 0 };

    const { request } = await exchange(() => listener.getNotifications(5), empty);

    expect(request).toEqual({
      bridgeName: 'notifications',
      methodName: 'get_notifications',
      data: { limit: 5 },
      callbackId: expect.any(String),
    });
  });

  it('should ask the notifications bridge to open the settings', async () => {
    const { request, result } = await exchange(() => listener.openSettings(), { opened: true });

    expect(request).toEqual({
      bridgeName: 'notifications',
      methodName: 'open_settings',
      callbackId: expect.any(String),
    });
    expect(result).toEqual({ opened: true });
  });

  it('should say why the settings could not be opened', async () => {
    const { result } = await exchange(() => listener.openSettings(), {
      opened: false,
      error: 'No Activity found to handle the intent',
    });

    expect(result).toEqual({ opened: false, error: 'No Activity found to handle the intent' });
  });
});
