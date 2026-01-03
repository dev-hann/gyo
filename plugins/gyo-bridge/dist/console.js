import { Bridge } from './Bridge';
/**
 * Initialize console bridge to forward web console logs to native
 * This allows developers to see web console logs in native dev tools (Logcat, Xcode console)
 */
export function initConsoleBridge(options = {}) {
    const { enabled = true, levels = ['log', 'info', 'warn', 'error', 'debug'] } = options;
    if (!enabled) {
        return () => { }; // No-op if disabled
    }
    // Create a special bridge for console logs
    const consoleBridge = new Bridge('gyo-console');
    // Store original console methods
    const originalConsole = {};
    // Intercept each console method
    levels.forEach((level) => {
        const originalMethod = console[level];
        if (!originalMethod)
            return;
        originalConsole[level] = originalMethod;
        // Override console method
        console[level] = function (...args) {
            // Call original console method first
            originalMethod.apply(console, args);
            // Send to native (fire and forget, don't await)
            try {
                const message = {
                    level,
                    args: serializeArgs(args),
                    timestamp: Date.now(),
                };
                // For errors, include stack trace
                if (level === 'error' && args[0] instanceof Error) {
                    message.stack = args[0].stack;
                }
                // Send to native without blocking
                consoleBridge.invoke('log', message).catch(() => {
                    // Silently fail if native bridge is not available
                    // We don't want console logging to break the app
                });
            }
            catch (e) {
                // Silently fail - console bridging should never break the app
            }
        };
    });
    // Return cleanup function to restore original console
    return () => {
        levels.forEach((level) => {
            if (originalConsole[level]) {
                console[level] = originalConsole[level];
            }
        });
    };
}
/**
 * Serialize console arguments for transmission to native
 */
function serializeArgs(args) {
    return args.map((arg) => {
        try {
            // Handle different types
            if (arg === null)
                return null;
            if (arg === undefined)
                return undefined;
            if (typeof arg === 'string')
                return arg;
            if (typeof arg === 'number')
                return arg;
            if (typeof arg === 'boolean')
                return arg;
            if (arg instanceof Error) {
                return {
                    __type: 'Error',
                    message: arg.message,
                    stack: arg.stack,
                    name: arg.name,
                };
            }
            if (arg instanceof Date) {
                return {
                    __type: 'Date',
                    value: arg.toISOString(),
                };
            }
            if (Array.isArray(arg)) {
                return arg.map((item) => serializeArgs([item])[0]);
            }
            if (typeof arg === 'object') {
                // Try to JSON stringify
                try {
                    JSON.stringify(arg);
                    return arg;
                }
                catch {
                    // Circular reference or non-serializable
                    return String(arg);
                }
            }
            // Fallback to string representation
            return String(arg);
        }
        catch {
            return '[Unserializable]';
        }
    });
}
