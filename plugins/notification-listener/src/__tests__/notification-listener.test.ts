import { NotificationListener } from '../NotificationListener';
import type { NotificationListResult, NotificationListenerStatus } from '../types';

/** What was posted to the native side, once the bridge has had a turn to send it. */
function posted(): {
  bridgeName: string;
  methodName: string;
  data: Record<string, unknown>;
  callbackId: string;
} {
  const raw = (window.androidBridge!.postMessage as jest.Mock).mock.calls[0][0] as string;
  return JSON.parse(raw);
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

  it('should ask the notification_listener bridge whether access is granted', async () => {
    const status: NotificationListenerStatus = { enabled: false };
    const pending = listener.isEnabled();

    await Promise.resolve();
    expect(posted()).toMatchObject({
      bridgeName: 'notification_listener',
      methodName: 'is_enabled',
    });
    window.gyoBridge!.resolve(posted().callbackId, status);

    await expect(pending).resolves.toEqual(status);
  });

  it('should read the most recent 50 notifications by default', async () => {
    const result: NotificationListResult = { notifications: [], count: 0 };
    const pending = listener.getNotifications();

    await Promise.resolve();
    expect(posted()).toMatchObject({
      bridgeName: 'notification_listener',
      methodName: 'get_notifications',
      data: { limit: 50 },
    });
    window.gyoBridge!.resolve(posted().callbackId, result);

    await expect(pending).resolves.toEqual(result);
  });

  it('should pass the limit it is given', async () => {
    const pending = listener.getNotifications(5);

    await Promise.resolve();
    expect(posted().data).toEqual({ limit: 5 });
    window.gyoBridge!.resolve(posted().callbackId, { notifications: [], count: 0 });

    await pending;
  });

  it('should ask the notification_listener bridge to open the settings', async () => {
    const pending = listener.openSettings();

    await Promise.resolve();
    expect(posted()).toMatchObject({
      bridgeName: 'notification_listener',
      methodName: 'open_settings',
    });
    window.gyoBridge!.resolve(posted().callbackId, { opened: true });

    await expect(pending).resolves.toEqual({ opened: true });
  });
});
