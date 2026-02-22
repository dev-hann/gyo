export const DEFAULT_PORT = 3000;
export const WEB_SERVER_TIMEOUT_MS = 30000;
export const PROCESS_KILL_TIMEOUT_MS = 2000;
export const LOCALHOST = "localhost";

export const DEFAULT_CONFIG = {
  name: "gyo-app",
  version: "1.0.0",
  profiles: {
    development: {
      serverUrl: "http://localhost:3000",
    },
    production: {
      serverUrl: "https://your-production-url.com",
    },
  },
  platforms: {
    android: {
      enabled: true,
      packageName: "com.example.gyoapp",
    },
    ios: {
      enabled: true,
      bundleId: "com.example.gyoapp",
    },
  },
  webview: {
    allowFileAccess: false,
    allowUniversalAccessFromFileURLs: false,
  },
  script: {
    start: "",
  },
};
