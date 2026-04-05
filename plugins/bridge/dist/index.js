// src/Bridge.ts
var Bridge = class {
  constructor(name, options = {}) {
    this.pendingCallbacks = /* @__PURE__ */ new Map();
    this.callbackCounter = 0;
    this.eventListeners = /* @__PURE__ */ new Set();
    this.activeTimers = /* @__PURE__ */ new Set();
    this.destroyed = false;
    this.name = name;
    this.timeout = options.timeout ?? 3e4;
    this.setupGlobalBridge();
  }
  /**
   * Setup global bridge interface for native to call
   */
  setupGlobalBridge() {
    if (!window.gyoBridge) {
      window.gyoBridge = {
        resolve: (callbackId, data) => {
          const pending = this.pendingCallbacks.get(callbackId);
          if (pending) {
            pending.resolve(data);
            this.pendingCallbacks.delete(callbackId);
          }
        },
        reject: (callbackId, error) => {
          const pending = this.pendingCallbacks.get(callbackId);
          if (pending) {
            pending.reject(new Error(error));
            this.pendingCallbacks.delete(callbackId);
          }
        },
        publish: (bridgeName, data) => {
          if (bridgeName === this.name) {
            this.eventListeners.forEach((listener) => listener(data));
          }
        }
      };
    } else {
      const originalPublish = window.gyoBridge.publish;
      window.gyoBridge.publish = (bridgeName, data) => {
        if (bridgeName === this.name) {
          this.eventListeners.forEach((listener) => listener(data));
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
  generateCallbackId() {
    return `${this.name}_${Date.now()}_${++this.callbackCounter}`;
  }
  /**
   * Detect platform and send message to native
   */
  sendToNative(request) {
    const message = JSON.stringify(request);
    if (window.androidBridge) {
      window.androidBridge.postMessage(message);
      return;
    }
    if (window.webkit?.messageHandlers?.gyoBridge) {
      window.webkit.messageHandlers.gyoBridge.postMessage(request);
      return;
    }
    throw new Error("No native bridge found. Make sure you are running in a WebView with bridge support.");
  }
  /**
   * Invoke a method on the native side
   * @param method - Method name to invoke
   * @param data - Optional data to send
   * @returns Promise that resolves with the native response
   */
  invoke(method, data) {
    if (this.destroyed) {
      return Promise.reject(new Error("Bridge has been destroyed"));
    }
    return new Promise((resolve, reject) => {
      const callbackId = this.generateCallbackId();
      this.pendingCallbacks.set(callbackId, { resolve, reject });
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        if (this.pendingCallbacks.has(callbackId)) {
          this.pendingCallbacks.delete(callbackId);
          reject(new Error(`Bridge method '${method}' timed out after ${this.timeout}ms`));
        }
      }, this.timeout);
      this.activeTimers.add(timer);
      const request = {
        bridgeName: this.name,
        methodName: method,
        data,
        callbackId
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
  listen(callback) {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }
  /**
   * Get the bridge name
   */
  getName() {
    return this.name;
  }
  /**
   * Clean up all pending callbacks and listeners
   */
  destroy() {
    this.destroyed = true;
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.pendingCallbacks.clear();
    this.eventListeners.clear();
  }
};
export {
  Bridge
};
