import { Bridge } from '@gyo-framework/bridge';
import type { GetInfoResult } from './types';

const BRIDGE_NAME = 'device_info';

export class DeviceInfo {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async getInfo(): Promise<GetInfoResult> {
    return this.bridge.invoke<GetInfoResult>('get_info');
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
