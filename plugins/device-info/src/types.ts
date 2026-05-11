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
