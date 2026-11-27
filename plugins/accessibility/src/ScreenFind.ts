import { Bridge } from '@gyo-framework/bridge';
import type { ScreenFindResult, FindByTextParams, FindByIdParams } from './types';

const BRIDGE_NAME = 'accessibility';

export class ScreenFind {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async findByText(params: FindByTextParams): Promise<ScreenFindResult> {
    return this.bridge.invoke<ScreenFindResult>('find_by_text', params);
  }

  async findById(params: FindByIdParams): Promise<ScreenFindResult> {
    return this.bridge.invoke<ScreenFindResult>('find_by_id', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
