import type {
  BridgeRequest,
  EventCallback,
  Unsubscribe,
  BridgeOptions,
  BridgeInterceptor,
} from './types';

/** A call native has not answered yet. `release` drops its timeout. */
interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  release: () => void;
}

export class Bridge {
  private static instances: Bridge[] = [];
  private static callbackMap: Map<string, PendingCall> = new Map();

  private name: string;
  private timeout: number;
  private interceptors: BridgeInterceptor[];
  private pendingCallbackIds: Set<string> = new Set();
  private callbackCounter: number = 0;
  private eventListeners: Set<EventCallback> = new Set();
  private activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private destroyed: boolean = false;

  constructor(name: string, options: BridgeOptions = {}) {
    this.name = name;
    this.timeout = options.timeout ?? 30000;
    this.interceptors = options.interceptors ?? [];
    Bridge.instances.push(this);
    this.setupGlobalBridge();
  }

  private static removeInstance(instance: Bridge): void {
    const idx = Bridge.instances.indexOf(instance);
    if (idx !== -1) {
      Bridge.instances.splice(idx, 1);
    }
  }

  /** Takes the call out of the pending set, so it can be settled exactly once. */
  private static takeCallback(callbackId: string): PendingCall | undefined {
    const pending = Bridge.callbackMap.get(callbackId);
    if (pending) {
      Bridge.callbackMap.delete(callbackId);
      pending.release();
    }
    return pending;
  }

  private setupGlobalBridge(): void {
    if (!window.gyoBridge) {
      window.gyoBridge = {
        resolve: (callbackId: string, data: unknown) => {
          Bridge.takeCallback(callbackId)?.resolve(data);
        },
        reject: (callbackId: string, error: string) => {
          Bridge.takeCallback(callbackId)?.reject(new Error(error));
        },
        publish: (bridgeName: string, data: unknown) => {
          for (const instance of Bridge.instances) {
            if (bridgeName === instance.name) {
              instance.eventListeners.forEach((listener) => {
                try {
                  listener(data);
                } catch {
                  // swallow listener errors to prevent blocking other listeners
                }
              });
            }
          }
        },
      };
    }
  }

  private generateCallbackId(): string {
    return `${this.name}_${Date.now()}_${++this.callbackCounter}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private sendToNative(request: BridgeRequest): void {
    const message = JSON.stringify(request);

    if (window.androidBridge) {
      window.androidBridge.postMessage(message);
      return;
    }

    if (window.webkit?.messageHandlers?.gyoBridge) {
      window.webkit.messageHandlers.gyoBridge.postMessage(request);
      return;
    }

    throw new Error(
      'No native bridge found. Make sure you are running in a WebView with bridge support.'
    );
  }

  private async runBeforeInvoke(request: BridgeRequest): Promise<BridgeRequest> {
    let result = request;
    for (const interceptor of this.interceptors) {
      if (interceptor.beforeInvoke) {
        result = await interceptor.beforeInvoke(result);
      }
    }
    return result;
  }

  public invoke<T = unknown>(method: string, data?: unknown): Promise<T> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
    }
    return new Promise<T>((resolve, reject) => {
      const callbackId = this.generateCallbackId();

      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        this.fail(
          { bridgeName: this.name, methodName: method, data, callbackId },
          new Error(`Bridge method '${method}' timed out after ${this.timeout}ms`)
        );
      }, this.timeout);
      this.activeTimers.add(timer);
      this.pendingCallbackIds.add(callbackId);

      Bridge.callbackMap.set(callbackId, {
        resolve: resolve as (value: unknown) => void,
        reject: reject as (reason: unknown) => void,
        release: () => {
          clearTimeout(timer);
          this.activeTimers.delete(timer);
          this.pendingCallbackIds.delete(callbackId);
        },
      });

      const request: BridgeRequest = {
        bridgeName: this.name,
        methodName: method,
        data,
        callbackId,
      };

      this.runBeforeInvoke(request)
        .then((finalRequest) => {
          try {
            this.sendToNative(finalRequest);
          } catch (error) {
            this.fail(finalRequest, error as Error);
          }
        })
        .catch((error) => {
          Bridge.takeCallback(callbackId)?.reject(error);
        });
    });
  }

  public listen(callback: EventCallback): Unsubscribe {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  public getName(): string {
    return this.name;
  }

  public isAvailable(): boolean {
    return !this.destroyed && !!(window.androidBridge || window.webkit?.messageHandlers?.gyoBridge);
  }

  /**
   * Rejects a call that can no longer succeed and tells the interceptors.
   * Does nothing once native has answered.
   */
  private fail(request: BridgeRequest, error: Error): void {
    const pending = Bridge.takeCallback(request.callbackId);
    if (!pending) {
      return;
    }
    this.runOnError(request, error);
    pending.reject(error);
  }

  private runOnError(request: BridgeRequest, error: Error): void {
    for (const interceptor of this.interceptors) {
      if (interceptor.onError) {
        try {
          interceptor.onError(request, error);
        } catch {
          // swallow interceptor errors
        }
      }
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    Bridge.removeInstance(this);

    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();

    // Nothing will answer these calls any more: settle them instead of
    // leaving the caller waiting.
    const destroyedError = new Error('Bridge has been destroyed');
    for (const id of this.pendingCallbackIds) {
      Bridge.takeCallback(id)?.reject(destroyedError);
    }
    this.pendingCallbackIds.clear();

    this.eventListeners.clear();
    this.interceptors = [];
  }
}
