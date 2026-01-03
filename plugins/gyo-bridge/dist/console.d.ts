type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';
/**
 * Initialize console bridge to forward web console logs to native
 * This allows developers to see web console logs in native dev tools (Logcat, Xcode console)
 */
export declare function initConsoleBridge(options?: {
    enabled?: boolean;
    levels?: ConsoleLevel[];
}): () => void;
export {};
//# sourceMappingURL=console.d.ts.map