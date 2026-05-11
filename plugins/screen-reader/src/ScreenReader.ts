import { Bridge } from '@gyo-framework/bridge';
import type { ReadResult, FindResult } from './types';

const BRIDGE_NAME = 'screen_reader';

export class ScreenReader {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async read(): Promise<ReadResult> {
    return this.bridge.invoke<ReadResult>('read');
  }

  async find(params: { text: string }): Promise<FindResult> {
    return this.bridge.invoke<FindResult>('find', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
