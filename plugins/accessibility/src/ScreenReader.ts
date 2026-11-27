import { Bridge } from '@gyo-framework/bridge';
import type { ReadResult, ScreenReaderFindResult, FindParams } from './types';

const BRIDGE_NAME = 'accessibility';

export class ScreenReader {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async read(): Promise<ReadResult> {
    return this.bridge.invoke<ReadResult>('read');
  }

  async find(params: FindParams): Promise<ScreenReaderFindResult> {
    return this.bridge.invoke<ScreenReaderFindResult>('find', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
