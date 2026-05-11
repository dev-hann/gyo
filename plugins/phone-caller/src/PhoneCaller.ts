import { Bridge } from '@gyo-framework/bridge';
import type { CallLogResult } from './types';

const BRIDGE_NAME = 'phone_caller';

export class PhoneCaller {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async call(params: { phoneNumber: string }): Promise<boolean> {
    return this.bridge.invoke<boolean>('call', params);
  }

  async getCallLog(params: { limit: number }): Promise<CallLogResult> {
    return this.bridge.invoke<CallLogResult>('get_call_log', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
