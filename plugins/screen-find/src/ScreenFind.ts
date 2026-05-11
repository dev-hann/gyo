import { Bridge } from '@gyo-framework/bridge';
import type { FindResult } from './types';

const BRIDGE_NAME = 'screen_find';

export class ScreenFind {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async findByText(params: { text: string; exact: boolean }): Promise<FindResult> {
    return this.bridge.invoke<FindResult>('find_by_text', params);
  }

  async findById(params: { id: string }): Promise<FindResult> {
    return this.bridge.invoke<FindResult>('find_by_id', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
