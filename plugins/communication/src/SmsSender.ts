import { Bridge } from '@gyo-framework/bridge';
import { BRIDGE_NAME } from './constants';
import type { ReadResult } from './types';

export class SmsSender {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async send(params: { phoneNumber: string; message: string }): Promise<boolean> {
    return this.bridge.invoke<boolean>('send', params);
  }

  async read(params: { limit: number }): Promise<ReadResult> {
    return this.bridge.invoke<ReadResult>('read', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
