export type Platform = 'android' | 'ios';

export interface ProfileConfig {
  serverUrl: string;
}

export interface BasePlatformConfig {
  enabled: boolean;
}

export interface AndroidPlatformConfig extends BasePlatformConfig {
  packageName?: string;
}

export interface IOSPlatformConfig extends BasePlatformConfig {
  bundleId?: string;
}

export interface GyoConfig {
  name: string;
  version: string;
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
  };
}
