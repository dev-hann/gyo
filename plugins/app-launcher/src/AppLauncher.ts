import { Bridge } from '@gyo-framework/bridge';
import type {
  ListAppsResult,
  OpenAppParams,
  OpenUrlParams,
  SearchAppsParams,
  SearchAppsResult,
} from './types';

const BRIDGE_NAME = 'app_launcher';

export class AppLauncher {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async listApps(): Promise<ListAppsResult> {
    return this.bridge.invoke<ListAppsResult>('list_apps');
  }

  async openApp(params: OpenAppParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('open_app', params);
  }

  async openUrl(params: OpenUrlParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('open_url', params);
  }

  async searchApps(params: SearchAppsParams): Promise<SearchAppsResult> {
    return this.bridge.invoke<SearchAppsResult>('search_apps', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
