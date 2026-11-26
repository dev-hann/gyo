import { Bridge } from '@gyo-framework/bridge';
import type { HttpRequest, HttpResponse } from './types';

const BRIDGE_NAME = 'http';
// Generous on purpose: a slow page is cut off by the native timeouts, which say why.
const TIMEOUT_MS = 60_000;

export class Http {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME, { timeout: TIMEOUT_MS });
  }

  /**
   * GETs the url. Resolves with whatever status the server answered, 404 and
   * 503 included; rejects when no response arrived at all, such as a timeout
   * or a connection that could not be made.
   */
  request(request: HttpRequest): Promise<HttpResponse> {
    return this.bridge.invoke<HttpResponse>('request', request);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
