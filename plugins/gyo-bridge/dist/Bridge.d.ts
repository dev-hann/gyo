import type { EventCallback, Unsubscribe } from './types';
/**
 * Bridge class for web-native communication
 */
export declare class Bridge {
    private name;
    private pendingCallbacks;
    private callbackCounter;
    private eventListeners;
    constructor(name: string);
    /**
     * Setup global bridge interface for native to call
     */
    private setupGlobalBridge;
    /**
     * Generate unique callback ID
     */
    private generateCallbackId;
    /**
     * Detect platform and send message to native
     */
    private sendToNative;
    /**
     * Invoke a method on the native side
     * @param method - Method name to invoke
     * @param data - Optional data to send
     * @returns Promise that resolves with the native response
     */
    invoke<T = any>(method: string, data?: any): Promise<T>;
    /**
     * Listen to events from native
     * @param callback - Function to call when event is received
     * @returns Unsubscribe function
     */
    listen(callback: EventCallback): Unsubscribe;
    /**
     * Get the bridge name
     */
    getName(): string;
    /**
     * Clean up all pending callbacks and listeners
     */
    destroy(): void;
}
//# sourceMappingURL=Bridge.d.ts.map