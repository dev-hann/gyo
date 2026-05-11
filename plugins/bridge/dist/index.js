// src/Bridge.ts
var _Bridge = class _Bridge {
  constructor(name, options = {}) {
    this.pendingCallbackIds = /* @__PURE__ */ new Set();
    this.callbackCounter = 0;
    this.eventListeners = /* @__PURE__ */ new Set();
    this.activeTimers = /* @__PURE__ */ new Set();
    this.destroyed = false;
    this.name = name;
    this.timeout = options.timeout ?? 3e4;
    this.interceptors = options.interceptors ?? [];
    _Bridge.instances.push(this);
    this.setupGlobalBridge();
  }
  static removeInstance(instance) {
    const idx = _Bridge.instances.indexOf(instance);
    if (idx !== -1) {
      _Bridge.instances.splice(idx, 1);
    }
  }
  static findCallback(callbackId) {
    const pending = _Bridge.callbackMap.get(callbackId);
    if (pending) {
      _Bridge.callbackMap.delete(callbackId);
    }
    return pending;
  }
  setupGlobalBridge() {
    if (!window.gyoBridge) {
      window.gyoBridge = {
        resolve: (callbackId, data) => {
          const pending = _Bridge.findCallback(callbackId);
          pending?.resolve(data);
        },
        reject: (callbackId, error) => {
          const pending = _Bridge.findCallback(callbackId);
          pending?.reject(new Error(error));
        },
        publish: (bridgeName, data) => {
          for (const instance of _Bridge.instances) {
            if (bridgeName === instance.name) {
              instance.eventListeners.forEach((listener) => {
                try {
                  listener(data);
                } catch {
                }
              });
            }
          }
        }
      };
    }
  }
  generateCallbackId() {
    return `${this.name}_${Date.now()}_${++this.callbackCounter}_${Math.random().toString(36).slice(2, 8)}`;
  }
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
    throw new Error(
      "No native bridge found. Make sure you are running in a WebView with bridge support."
    );
  }
  async runBeforeInvoke(request) {
    let result = request;
    for (const interceptor of this.interceptors) {
      if (interceptor.beforeInvoke) {
        result = await interceptor.beforeInvoke(result);
      }
    }
    return result;
  }
  invoke(method, data) {
    if (this.destroyed) {
      return Promise.reject(new Error("Bridge has been destroyed"));
    }
    return new Promise((resolve, reject) => {
      const callbackId = this.generateCallbackId();
      this.pendingCallbackIds.add(callbackId);
      _Bridge.callbackMap.set(callbackId, {
        resolve,
        reject
      });
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        if (this.pendingCallbackIds.has(callbackId)) {
          this.pendingCallbackIds.delete(callbackId);
          _Bridge.callbackMap.delete(callbackId);
          const error = new Error(`Bridge method '${method}' timed out after ${this.timeout}ms`);
          this.runOnError({ bridgeName: this.name, methodName: method, data, callbackId }, error);
          reject(error);
        }
      }, this.timeout);
      this.activeTimers.add(timer);
      const request = {
        bridgeName: this.name,
        methodName: method,
        data,
        callbackId
      };
      this.runBeforeInvoke(request).then((finalRequest) => {
        try {
          this.sendToNative(finalRequest);
        } catch (error) {
          this.pendingCallbackIds.delete(callbackId);
          _Bridge.callbackMap.delete(callbackId);
          this.runOnError(finalRequest, error);
          reject(error);
        }
      }).catch((error) => {
        this.pendingCallbackIds.delete(callbackId);
        _Bridge.callbackMap.delete(callbackId);
        reject(error);
      });
    });
  }
  listen(callback) {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }
  getName() {
    return this.name;
  }
  isAvailable() {
    return !this.destroyed && !!(window.androidBridge || window.webkit?.messageHandlers?.gyoBridge);
  }
  runOnError(request, error) {
    for (const interceptor of this.interceptors) {
      if (interceptor.onError) {
        try {
          interceptor.onError(request, error);
        } catch {
        }
      }
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    _Bridge.removeInstance(this);
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    for (const id of this.pendingCallbackIds) {
      _Bridge.callbackMap.delete(id);
    }
    this.pendingCallbackIds.clear();
    this.eventListeners.clear();
    this.interceptors = [];
  }
};
_Bridge.instances = [];
_Bridge.callbackMap = /* @__PURE__ */ new Map();
var Bridge = _Bridge;
export {
  Bridge
};
