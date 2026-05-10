/**
 * Message sent from web to native
 */
interface BridgeRequest {
    bridgeName: string;
    methodName: string;
    data?: unknown;
    callbackId: string;
}
/**
 * Response from native to web
 */
interface BridgeResponse {
    callbackId: string;
    success: boolean;
    data?: unknown;
    error?: string;
}
/**
 * Event from native to web
 */
interface BridgeEvent {
    bridgeName: string;
    data: unknown;
}
/**
 * Callback for event listeners
 */
type EventCallback = (data: unknown) => void;
/**
 * Unsubscribe function
 */
type Unsubscribe = () => void;
/**
 * Bridge configuration options
 */
interface BridgeOptions {
    /**
     * Timeout in milliseconds for method invocation
     * @default 30000
     */
    timeout?: number;
}
/**
 * Android bridge interface
 */
interface AndroidBridge {
    postMessage(message: string): void;
}
/**
 * iOS bridge interface
 */
interface IOSMessageHandler {
    postMessage(message: unknown): void;
}
/**
 * Extended window interface
 */
declare global {
    interface Window {
        androidBridge?: AndroidBridge;
        webkit?: {
            messageHandlers?: {
                gyoBridge?: IOSMessageHandler;
            };
        };
        gyoBridge?: {
            resolve: (callbackId: string, data: unknown) => void;
            reject: (callbackId: string, error: string) => void;
            publish: (bridgeName: string, data: unknown) => void;
        };
    }
}

/**
 * Bridge class for web-native communication
 */
declare class Bridge {
    private static instances;
    private name;
    private timeout;
    private pendingCallbacks;
    private callbackCounter;
    private eventListeners;
    private activeTimers;
    private destroyed;
    constructor(name: string, options?: BridgeOptions);
    private static findCallback;
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
    invoke<T = unknown>(method: string, data?: unknown): Promise<T>;
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

export { Bridge, type BridgeEvent, type BridgeOptions, type BridgeRequest, type BridgeResponse, type EventCallback, type Unsubscribe };
