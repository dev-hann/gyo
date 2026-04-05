import type {
  BridgeRequest,
  EventCallback,
  Unsubscribe,
  BridgeOptions,
} from './types';

/**
 * Bridge class for web-native communication
 */
export class Bridge {
  private name: string;
  private timeout: number;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private pendingCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();
  private callbackCounter: number = 0;
  private eventListeners: Set<EventCallback> = new Set();
  private activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private destroyed: boolean = false;

  constructor(name: string, options: BridgeOptions = {}) {
    this.name = name;
    this.timeout = options.timeout ?? 30000;
    this.setupGlobalBridge();
  }

  /**
   * Setup global bridge interface for native to call
   */
  private setupGlobalBridge(): void {
    if (!window.gyoBridge) {
      window.gyoBridge = {
        resolve: (callbackId: string, data: unknown) => {
          const pending = this.pendingCallbacks.get(callbackId);
          if (pending) {
            pending.resolve(data);
            this.pendingCallbacks.delete(callbackId);
          }
        },
        reject: (callbackId: string, error: string) => {
          const pending = this.pendingCallbacks.get(callbackId);
          if (pending) {
            pending.reject(new Error(error));
            this.pendingCallbacks.delete(callbackId);
          }
        },
        publish: (bridgeName: string, data: unknown) => {
          if (bridgeName === this.name) {
            this.eventListeners.forEach(listener => listener(data));
          }
        },
      };
    } else {
      const originalPublish = window.gyoBridge.publish;
      window.gyoBridge.publish = (bridgeName: string, data: unknown) => {
        if (bridgeName === this.name) {
          this.eventListeners.forEach(listener => listener(data));
        }
        if (originalPublish) {
          originalPublish.call(window.gyoBridge, bridgeName, data);
        }
      };
    }
  }

  /**
   * Generate unique callback ID
   */
  private generateCallbackId(): string {
    return `${this.name}_${Date.now()}_${++this.callbackCounter}`;
  }

  /**
   * Detect platform and send message to native
   */
  private sendToNative(request: BridgeRequest): void {
    const message = JSON.stringify(request);

    // Android
    if (window.androidBridge) {
      window.androidBridge.postMessage(message);
      return;
    }

    // iOS
    if (window.webkit?.messageHandlers?.gyoBridge) {
      window.webkit.messageHandlers.gyoBridge.postMessage(request);
      return;
    }

    // No native bridge found
    throw new Error('No native bridge found. Make sure you are running in a WebView with bridge support.');
  }

  /**
   * Invoke a method on the native side
   * @param method - Method name to invoke
   * @param data - Optional data to send
   * @returns Promise that resolves with the native response
   */
  public invoke<T = unknown>(method: string, data?: unknown): Promise<T> {
    if (this.destroyed) {
      return Promise.reject(new Error('Bridge has been destroyed'));
    }
    return new Promise((resolve, reject) => {
      const callbackId = this.generateCallbackId();
      
      // Store callback
      this.pendingCallbacks.set(callbackId, { resolve, reject });

      // Set timeout to reject if no response
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        if (this.pendingCallbacks.has(callbackId)) {
          this.pendingCallbacks.delete(callbackId);
          reject(new Error(`Bridge method '${method}' timed out after ${this.timeout}ms`));
        }
      }, this.timeout);
      this.activeTimers.add(timer);

      const request: BridgeRequest = {
        bridgeName: this.name,
        methodName: method,
        data,
        callbackId,
      };

      try {
        this.sendToNative(request);
      } catch (error) {
        this.pendingCallbacks.delete(callbackId);
        reject(error);
      }
    });
  }

  /**
   * Listen to events from native
   * @param callback - Function to call when event is received
   * @returns Unsubscribe function
   */
  public listen(callback: EventCallback): Unsubscribe {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Get the bridge name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Clean up all pending callbacks and listeners
   */
  public destroy(): void {
    this.destroyed = true;

    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();

    this.pendingCallbacks.clear();
    this.eventListeners.clear();
  }
}
