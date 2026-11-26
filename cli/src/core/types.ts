export type Platform = 'android' | 'ios';

export interface ProfileConfig {
  serverUrl: string;
}

export interface BasePlatformConfig {
  enabled: boolean;
}

export interface AndroidPlatformConfig extends BasePlatformConfig {
  packageName?: string;
  /** Android `versionCode`. Must grow for every release installed over an older one. */
  versionCode?: number;
  /** Launcher icon (PNG), relative to gyo.config.json. */
  icon?: string;
}

export interface IOSPlatformConfig extends BasePlatformConfig {
  bundleId?: string;
}

export interface GyoConfig {
  name: string;
  version: string;
  /** Name shown under the launcher icon. Defaults to `name`. */
  displayName?: string;
  framework?: string;
  serverUrl?: string;
  profiles?: {
    [key: string]: ProfileConfig;
  };
  platforms: {
    android?: AndroidPlatformConfig;
    ios?: IOSPlatformConfig;
    [key: string]: BasePlatformConfig | undefined;
  };
  webview?: {
    allowFileAccess?: boolean;
    allowUniversalAccessFromFileURLs?: boolean;
    userAgent?: string;
  };
  script?: {
    start?: string;
    preStartCleanup?: string[];
  };
}
