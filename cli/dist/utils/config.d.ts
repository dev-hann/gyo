export interface GyoConfig {
    name: string;
    version: string;
    serverUrl: string;
    platforms: {
        android?: {
            enabled: boolean;
            packageName?: string;
        };
        ios?: {
            enabled: boolean;
            bundleId?: string;
        };
        desktop?: {
            enabled: boolean;
        };
    };
    webview?: {
        allowFileAccess?: boolean;
        allowUniversalAccessFromFileURLs?: boolean;
        userAgent?: string;
    };
    devServer?: {
        port?: number;
        host?: string;
    };
}
export declare const DEFAULT_CONFIG: GyoConfig;
export declare function loadConfig(projectPath?: string): Promise<GyoConfig | null>;
export declare function saveConfig(config: GyoConfig, projectPath?: string): Promise<void>;
export declare function validateConfig(config: GyoConfig): boolean;
//# sourceMappingURL=config.d.ts.map