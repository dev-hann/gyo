import { Bridge } from '@gyo-framework/bridge';
import { BRIDGE_NAME } from './constants';
import type { SearchResult } from './types';

export class ContactSearch {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async search(params: { query: string }): Promise<SearchResult> {
    return this.bridge.invoke<SearchResult>('search', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
