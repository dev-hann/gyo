/**
 * Message sent from web to native
 */
export interface BridgeRequest {
  bridgeName: string;
  methodName: string;
  data?: unknown;
  callbackId: string;
}

/**
 * Response from native to web
 */
export interface BridgeResponse {
  callbackId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Event from native to web
 */
export interface BridgeEvent {
  bridgeName: string;
  data: unknown;
}

/**
 * Callback for event listeners
 */
export type EventCallback = (data: unknown) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Bridge interceptor for cross-cutting concerns
 */
export interface BridgeInterceptor {
  beforeInvoke?(request: BridgeRequest): BridgeRequest | Promise<BridgeRequest>;
  onError?(request: BridgeRequest, error: Error): void;
}

/**
 * Bridge configuration options
 */
export interface BridgeOptions {
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
export interface AndroidBridge {
  postMessage(message: string): void;
}

/**
 * iOS bridge interface
 */
export interface IOSMessageHandler {
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
