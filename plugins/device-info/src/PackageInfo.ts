import { Bridge } from '@gyo-framework/bridge';
import type { PackageInfoResult } from './types';

const BRIDGE_NAME = 'device_info';

export class PackageInfo {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  /** The app as Android installed it: `versionName` is what people read, `versionCode` what an update is decided on. */
  async getInfo(): Promise<PackageInfoResult> {
    return this.bridge.invoke<PackageInfoResult>('get_package_info');
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
