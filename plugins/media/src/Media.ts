import { Bridge } from '@gyo-framework/bridge';
import type { SaveRequest, SaveResult, ShareRequest, ShareResult } from './types';

const BRIDGE_NAME = 'media';
// Generous on purpose: a video takes as long as it takes to arrive, and the
// native timeouts, which say why they gave up, come first.
const TIMEOUT_MS = 300_000;

export class Media {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME, { timeout: TIMEOUT_MS });
  }

  /**
   * Downloads the media at the url and stores it where the system keeps
   * pictures, videos or downloads. A failure resolves as a value, with its
   * kind; only a fault of the bridge itself rejects, such as no native side
   * or a timeout.
   */
  saveToGallery(request: SaveRequest): Promise<SaveResult> {
    return this.bridge.invoke<SaveResult>('save_to_gallery', request);
  }

  /**
   * Offers the media at the url, or a text, to another app through the system
   * chooser. Resolves once the chooser is open; what the user does there is
   * not reported. Failures resolve as values, as `saveToGallery` does.
   */
  share(request: ShareRequest): Promise<ShareResult> {
    return this.bridge.invoke<ShareResult>('share', request);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
