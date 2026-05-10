/// <reference types="@gyo-framework/bridge" />

type MockedInvoke = jest.Mock<Promise<unknown>, [string, unknown?]>;
type MockedListen = jest.Mock<() => void, [(data: unknown) => void]>;

export interface BridgeMockResult {
  mockInvoke: MockedInvoke;
  mockListen: MockedListen;
  simulateEvent: (data: unknown) => void;
  simulateResponse: (callbackId: string, data: unknown) => void;
  simulateError: (callbackId: string, error: string) => void;
  restore: () => void;
}

export function createBridgeMock(name: string): BridgeMockResult {
  const invokeHandlers: Map<string, (data?: unknown) => unknown> = new Map();
  const eventListeners: Set<(data: unknown) => void> = new Set();
  const pendingResolvers: Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  > = new Map();

  const mockInvoke: MockedInvoke = jest.fn(async (method: string, data?: unknown) => {
    const handler = invokeHandlers.get(method);
    if (handler) {
      return handler(data);
    }
    return undefined;
  });

  const mockListen: MockedListen = jest.fn((callback: (data: unknown) => void) => {
    eventListeners.add(callback);
    return () => {
      eventListeners.delete(callback);
    };
  });

  const simulateEvent = (data: unknown): void => {
    eventListeners.forEach((listener) => listener(data));
  };

  const simulateResponse = (callbackId: string, data: unknown): void => {
    const pending = pendingResolvers.get(callbackId);
    if (pending) {
      pendingResolvers.delete(callbackId);
      pending.resolve(data);
    }
  };

  const simulateError = (callbackId: string, error: string): void => {
    const pending = pendingResolvers.get(callbackId);
    if (pending) {
      pendingResolvers.delete(callbackId);
      pending.reject(new Error(error));
    }
  };

  if (!window.gyoBridge) {
    window.gyoBridge = {
      resolve: (callbackId: string, data: unknown) => {
        simulateResponse(callbackId, data);
      },
      reject: (callbackId: string, error: string) => {
        simulateError(callbackId, error);
      },
      publish: (bridgeName: string, data: unknown) => {
        if (bridgeName === name) {
          simulateEvent(data);
        }
      },
    };
  }

  return {
    mockInvoke,
    mockListen,
    simulateEvent,
    simulateResponse,
    simulateError,
    restore: () => {
      invokeHandlers.clear();
      eventListeners.clear();
      pendingResolvers.clear();
      mockInvoke.mockClear();
      mockListen.mockClear();
      delete (window as unknown as Record<string, unknown>).gyoBridge;
    },
  };
}
