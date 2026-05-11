import { Bridge } from '@gyo-framework/bridge';
import type { ListResult } from './types';

const BRIDGE_NAME = 'notification_reader';

export class NotificationReader {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async list(): Promise<ListResult> {
    return this.bridge.invoke<ListResult>('list');
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
