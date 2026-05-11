import { Bridge } from '@gyo-framework/bridge';
import type { SearchResult } from './types';

const BRIDGE_NAME = 'contact_search';

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
