import { Accessibility } from '../Accessibility';
import type { AccessibilityStatus } from '../types';

/** What was posted to the native side, once the bridge has had a turn to send it. */
function posted(): { bridgeName: string; methodName: string; callbackId: string } {
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

  it('should ask the accessibility bridge whether the service is on', async () => {
    const status: AccessibilityStatus = { enabled: true };
    const pending = accessibility.isEnabled();

    await Promise.resolve();
    expect(posted()).toMatchObject({ bridgeName: 'accessibility', methodName: 'is_enabled' });
    window.gyoBridge!.resolve(posted().callbackId, status);

    await expect(pending).resolves.toEqual(status);
  });

  it('should ask the accessibility bridge to open the settings', async () => {
    const pending = accessibility.openSettings();

    await Promise.resolve();
    expect(posted()).toMatchObject({ bridgeName: 'accessibility', methodName: 'open_settings' });
    window.gyoBridge!.resolve(posted().callbackId, { opened: true });

    await expect(pending).resolves.toEqual({ opened: true });
  });
});
