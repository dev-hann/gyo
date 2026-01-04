/**
 * Bridge class for web-native communication
 */
export class Bridge {
    constructor(name) {
        this.pendingCallbacks = new Map();
        this.callbackCounter = 0;
        this.eventListeners = new Set();
        this.name = name;
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
                    // This will be called by all bridge instances, so we need to filter by name
                    if (bridgeName === this.name) {
                        this.eventListeners.forEach(listener => listener(data));
                    }
                },
            };
        }
        else {
            // Extend existing gyoBridge to handle multiple bridge instances
            const originalPublish = window.gyoBridge.publish;
            window.gyoBridge.publish = (bridgeName, data) => {
                if (bridgeName === this.name) {
                    this.eventListeners.forEach(listener => listener(data));
                }
                // Call original publish in case other bridges are listening
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
    invoke(method, data) {
        return new Promise((resolve, reject) => {
            const callbackId = this.generateCallbackId();
            // Store callback
            this.pendingCallbacks.set(callbackId, { resolve, reject });
            // Set timeout to reject if no response
            setTimeout(() => {
                if (this.pendingCallbacks.has(callbackId)) {
                    this.pendingCallbacks.delete(callbackId);
                    reject(new Error(`Bridge method '${method}' timed out`));
                }
            }, 30000); // 30 second timeout
            const request = {
                bridgeName: this.name,
                methodName: method,
                data,
                callbackId,
            };
            try {
                this.sendToNative(request);
            }
            catch (error) {
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
        this.pendingCallbacks.clear();
        this.eventListeners.clear();
    }
}
