/**
 * Message sent from web to native
 */
export interface BridgeRequest {
    bridgeName: string;
    methodName: string;
    data?: any;
    callbackId: string;
}
/**
 * Response from native to web
 */
export interface BridgeResponse {
    callbackId: string;
    success: boolean;
    data?: any;
    error?: string;
}
/**
 * Event from native to web
 */
export interface BridgeEvent {
    bridgeName: string;
    data: any;
}
/**
 * Callback for event listeners
 */
export type EventCallback = (data: any) => void;
/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;
/**
 * Android bridge interface
 */
export interface AndroidBridge {
    postMessage(message: string): void;
}
/**
 * iOS bridge interface
 */
export interface IOSMessageHandler {
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
//# sourceMappingURL=types.d.ts.map