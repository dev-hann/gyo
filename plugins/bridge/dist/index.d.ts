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
 * Bridge interceptor for cross-cutting concerns
 */
interface BridgeInterceptor {
    beforeInvoke?(request: BridgeRequest): BridgeRequest | Promise<BridgeRequest>;
    onError?(request: BridgeRequest, error: Error): void;
}
/**
 * Bridge configuration options
 */
interface BridgeOptions {
    /**
     * Timeout in milliseconds for method invocation
     * @default 30000
     */
    timeout?: number;
    /**
     * Interceptors for cross-cutting concerns (logging, auth, error reporting)
     */
    interceptors?: BridgeInterceptor[];
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

declare class Bridge {
    private static instances;
    private static callbackMap;
    private name;
    private timeout;
    private interceptors;
    private pendingCallbackIds;
    private callbackCounter;
    private eventListeners;
    private activeTimers;
    private destroyed;
    constructor(name: string, options?: BridgeOptions);
    private static removeInstance;
    private static findCallback;
    private setupGlobalBridge;
    private generateCallbackId;
    private sendToNative;
    private runBeforeInvoke;
    invoke<T = unknown>(method: string, data?: unknown): Promise<T>;
    listen(callback: EventCallback): Unsubscribe;
    getName(): string;
    isAvailable(): boolean;
    private runOnError;
    destroy(): void;
}

export { type AndroidBridge, Bridge, type BridgeEvent, type BridgeInterceptor, type BridgeOptions, type BridgeRequest, type BridgeResponse, type EventCallback, type IOSMessageHandler, type Unsubscribe };
