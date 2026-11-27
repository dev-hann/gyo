import type { BridgeRequest } from '@gyo-framework/bridge';

/** Removes from `window` the native side, and what a Bridge installs to be answered by it. */
export function clearNativeSide(): void {
  delete window.gyoBridge;
  delete window.androidBridge;
  delete window.webkit;
}

/**
 * A call the test answers later. Its rejection is handled here, so that a test
 * which fails first does not crash the run: `destroy()` in `afterEach` rejects
 * every call left unanswered.
 */
export function handled<T>(pending: Promise<T>): Promise<T> {
  pending.catch(() => undefined);
  return pending;
}

/** A request the Bridge posted to `window.androidBridge`, once it has had a turn to send it. */
export function posted(postMessage: jest.Mock, index = 0): BridgeRequest {
  const raw = postMessage.mock.calls[index]?.[0] as string | undefined;
  if (raw === undefined) {
    throw new Error(`The bridge posted no request number ${index}.`);
  }
  return JSON.parse(raw) as BridgeRequest;
}

/** What a call to `methodName` with `data` has to look like once the Bridge posted it. */
export function communicationRequest(methodName: string, data: unknown): BridgeRequest {
  return { bridgeName: 'communication', methodName, data, callbackId: expect.any(String) };
}
