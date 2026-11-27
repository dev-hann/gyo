import { Bridge } from '@gyo-framework/bridge';
import type { NotificationListenerStatus, NotificationListResult } from './types';

const BRIDGE_NAME = 'notifications';

export class NotificationListener {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async isEnabled(): Promise<NotificationListenerStatus> {
    return this.bridge.invoke<NotificationListenerStatus>('is_enabled');
  }

  async getNotifications(limit: number = 50): Promise<NotificationListResult> {
    return this.bridge.invoke<NotificationListResult>('get_notifications', { limit });
  }

  async openSettings(): Promise<{ opened: boolean }> {
    return this.bridge.invoke<{ opened: boolean }>('open_settings');
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
