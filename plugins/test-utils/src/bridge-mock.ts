import type { BridgeRequest } from '@gyo-framework/bridge';

export interface BridgeMock {
  /** What the page posted to native, oldest first. */
  requests(): BridgeRequest[];
  /** Answers a request, the latest by default, as native does on success. */
  resolve(data: unknown, request?: BridgeRequest): void;
  /** Answers a request, the latest by default, as native does on failure. */
  reject(message: string, request?: BridgeRequest): void;
  /** Publishes an event to the listeners the bridge called `name` registered. */
  emitEvent(data: unknown): void;
  restore(): void;
}

/**
 * Replaces the native side of the bridge for one bridge name. The real
 * `Bridge` of the code under test stays in place: it is what turns a
 * request into a promise, so that a test exercises the same path the app
 * runs in the WebView.
 *
 * Call `setPlatform` first or not at all: the mock brings the Android
 * native object itself.
 */
export function createBridgeMock(name: string): BridgeMock {
  const posted: BridgeRequest[] = [];

  (window as unknown as Record<string, unknown>).androidBridge = {
    postMessage: (message: string) => {
      posted.push(JSON.parse(message) as BridgeRequest);
    },
  };

  const answerable = (request: BridgeRequest | undefined): BridgeRequest => {
    const target = request ?? posted.at(-1);
    if (target === undefined) {
      throw new Error('The page posted nothing to native: call a bridge method first.');
    }
    return target;
  };

  return {
    requests: () => [...posted],

    resolve: (data, request) => {
      const gyoBridge = window.gyoBridge;
      if (!gyoBridge) {
        throw new Error('No Bridge was created: the code under test has to make one.');
      }
      gyoBridge.resolve(answerable(request).callbackId, data);
    },

    reject: (message, request) => {
      const gyoBridge = window.gyoBridge;
      if (!gyoBridge) {
        throw new Error('No Bridge was created: the code under test has to make one.');
      }
      gyoBridge.reject(answerable(request).callbackId, message);
    },

    emitEvent: (data) => {
      window.gyoBridge?.publish(name, data);
    },

    restore: () => {
      posted.length = 0;
      // The Bridge installs window.gyoBridge only where there is none, so
      // the next test gets its own.
      delete (window as unknown as Record<string, unknown>).gyoBridge;
      delete (window as unknown as Record<string, unknown>).androidBridge;
      delete (window as unknown as Record<string, unknown>).webkit;
    },
  };
}
