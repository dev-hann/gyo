import { Bridge } from '@gyo-framework/bridge';
import type { AccessibilityStatus } from './types';

const BRIDGE_NAME = 'accessibility';

export class Accessibility {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async isEnabled(): Promise<AccessibilityStatus> {
    return this.bridge.invoke<AccessibilityStatus>('is_enabled');
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
