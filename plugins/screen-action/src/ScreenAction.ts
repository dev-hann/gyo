import { Bridge } from '@gyo-framework/bridge';
import type { TapParams, TypeParams, SwipeParams, GlobalActionParams } from './types';

const BRIDGE_NAME = 'screen_action';

export class ScreenAction {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  async tap(params: TapParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('tap', params);
  }

  async type(params: TypeParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('type', params);
  }

  async swipe(params: SwipeParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('swipe', params);
  }

  async globalAction(params: GlobalActionParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('global', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
