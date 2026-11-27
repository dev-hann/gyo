import { Accessibility } from '../Accessibility';
import type { AccessibilityStatus } from '../types';

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

describe('Accessibility', () => {
  let accessibility: Accessibility;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    accessibility = new Accessibility();
  });

  afterEach(() => {
    accessibility.destroy();
  });

  it('should be available once the native bridge is', () => {
    expect(accessibility.isAvailable()).toBe(true);
  });

  it('should be unavailable once destroyed', () => {
    accessibility.destroy();

    expect(accessibility.isAvailable()).toBe(false);
  });

  describe('isEnabled', () => {
    it('should ask the accessibility bridge whether the service is on', async () => {
      const status: AccessibilityStatus = { enabled: true };
      const pending = accessibility.isEnabled();

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, status);
      const result = await pending;

      expect(result).toEqual(status);
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'is_enabled',
        callbackId: expect.any(String),
      });
    });
  });

  describe('openSettings', () => {
    it('should ask the accessibility bridge to open the settings', async () => {
      const pending = accessibility.openSettings();

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, { opened: true });
      const result = await pending;

      expect(result).toEqual({ opened: true });
      expect(request).toEqual({
        bridgeName: 'accessibility',
        methodName: 'open_settings',
        callbackId: expect.any(String),
      });
    });

    it('should say why the settings could not be opened', async () => {
      const pending = accessibility.openSettings();

      await Promise.resolve();
      const request = posted();
      window.gyoBridge!.resolve(request.callbackId, { opened: false, error: 'No Activity found' });

      await expect(pending).resolves.toEqual({ opened: false, error: 'No Activity found' });
    });
  });
});
