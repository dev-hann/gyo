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

  /** `error` says why, when `opened` is `false`. */
  async openSettings(): Promise<{ opened: boolean; error?: string }> {
    return this.bridge.invoke<{ opened: boolean; error?: string }>('open_settings');
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
