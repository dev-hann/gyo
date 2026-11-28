export interface DeviceInfo {
  manufacturer: string;
  model: string;
  brand: string;
  device: string;
  androidVersion: string;
  sdkVersion: number;
  securityPatch: string;
  screenDensity: number;
  screenWidth: number;
  screenHeight: number;
  batteryLevel: number;
  isCharging: boolean;
}

export interface GetInfoResult {
  info: DeviceInfo;
}

export interface PackageInfoResult {
  /** The application ID, as Android names the app: `com.example.app`. */
  packageName: string;
  /** The name under the app's icon. */
  appName: string;
  /** The version people read, the `versionName` of the build: `4.0.0`. */
  versionName: string;
  /** The version Android compares, the `versionCode` of the build: a newer build has a larger one. */
  versionCode: number;
}
