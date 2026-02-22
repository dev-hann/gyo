export type Platform = "android" | "ios";

export interface ProfileConfig {
  serverUrl: string;
}

export interface GyoConfig {
  name: string;
  version: string;
  serverUrl?: string;
  profiles?: {
    [key: string]: ProfileConfig;
  };
  platforms: {
    android?: {
      enabled: boolean;
      packageName?: string;
    };
    ios?: {
      enabled: boolean;
      bundleId?: string;
    };
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
