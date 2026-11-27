import { requestPermissions } from '../permissions';
import type { PermissionResult } from '../types';

const READ_CONTACTS = 'android.permission.READ_CONTACTS';
const SEND_SMS = 'android.permission.SEND_SMS';

/** What was posted to the shell, once the bridge has had a turn to send it. */
function posted(): {
  bridgeName: string;
  methodName: string;
  data: { permissions: string[] };
  callbackId: string;
} {
  const raw = (window.androidBridge!.postMessage as jest.Mock).mock.calls[0][0] as string;
  return JSON.parse(raw);
}

describe('requestPermissions', () => {
  let postMessage: jest.Mock;

  // The function keeps one bridge for the life of the page, and that bridge
  // set up window.gyoBridge the first time it was asked.
  beforeAll(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
  });

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
  });

  it('should ask the shell handler for the permissions', async () => {
    const result: PermissionResult = { granted: [READ_CONTACTS], denied: [] };
    const pending = requestPermissions([READ_CONTACTS]);

    await Promise.resolve();
    expect(posted()).toMatchObject({
      bridgeName: 'permissions',
      methodName: 'request',
      data: { permissions: [READ_CONTACTS] },
    });

    window.gyoBridge!.resolve(posted().callbackId, result);

    await expect(pending).resolves.toEqual(result);
  });

  it('should pass on what the user refused', async () => {
    const result: PermissionResult = { granted: [READ_CONTACTS], denied: [SEND_SMS] };
    const pending = requestPermissions([READ_CONTACTS, SEND_SMS]);

    await Promise.resolve();
    window.gyoBridge!.resolve(posted().callbackId, result);

    await expect(pending).resolves.toEqual(result);
  });

  it('should reject outside the Android shell', async () => {
    delete (window as unknown as Record<string, unknown>).androidBridge;

    await expect(requestPermissions([READ_CONTACTS])).rejects.toThrow('No native bridge found');
  });
});
