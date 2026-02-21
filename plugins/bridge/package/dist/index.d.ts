/**
 * Message sent from web to native
 */
interface BridgeRequest {
    bridgeName: string;
    methodName: string;
    data?: any;
    callbackId: string;
}
/**
 * Response from native to web
 */
interface BridgeResponse {
    callbackId: string;
    success: boolean;
    data?: any;
    error?: string;
}
/**
 * Event from native to web
 */
interface BridgeEvent {
    bridgeName: string;
    data: any;
}
/**
 * Callback for event listeners
 */
type EventCallback = (data: any) => void;
/**
 * Unsubscribe function
 */
type Unsubscribe = () => void;
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
    postMessage(message: any): void;
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
            resolve: (callbackId: string, data: any) => void;
            reject: (callbackId: string, error: string) => void;
            publish: (bridgeName: string, data: any) => void;
        };
    }
}

/**
 * Bridge class for web-native communication
 */
declare class Bridge {
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

export { Bridge, type BridgeEvent, type BridgeRequest, type BridgeResponse, type EventCallback, type Unsubscribe };
