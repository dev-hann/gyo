import { Bridge } from '@gyo-framework/bridge';
import type { DownloadOptions, DownloadProgress, DownloadRequest, DownloadResult } from './types';

const BRIDGE_NAME = 'http';
// Generous on purpose: a file has no size limit, and the native side cuts a stalled one off.
const TIMEOUT_MS = 10 * 60 * 1000;

/** What native publishes while a download runs; the page sees the `progress` of its own downloadId. */
interface DownloadEvent {
  type: 'progress';
  downloadId: string;
  bytesWritten: number;
  totalBytes: number;
}

/** Why a download ended that the page itself cancelled. */
export class DownloadCancelledError extends Error {
  constructor() {
    super('Download cancelled');
    this.name = 'DownloadCancelledError';
  }
}

/** What a `download` returns: the file once it is whole, and the way to stop wanting it. */
export interface DownloadTask {
  /** The file once it is whole. Rejects when the download fails, and with a `DownloadCancelledError` when it was cancelled. */
  result: Promise<DownloadResult>;
  cancel(): void;
}

export class Downloader {
  private bridge: Bridge;

  /** What to tell about the progress of each download that runs, by downloadId. */
  private progressListeners = new Map<string, (progress: DownloadProgress) => void>();
  private cancelled = new Set<string>();
  private counter = 0;
  private stopListening: (() => void) | null = null;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME, { timeout: TIMEOUT_MS });
    this.stopListening = this.bridge.listen((event) => this.onEvent(event));
  }

  /**
   * GETs the url and writes what arrives to a file in the app's cache: a
   * private place, so no permission is needed. Rejects when the server
   * answers anything but 2xx, and when no response arrived at all.
   */
  download(request: DownloadRequest, options: DownloadOptions = {}): DownloadTask {
    const downloadId = `${Date.now()}_${++this.counter}_${Math.random().toString(36).slice(2, 8)}`;
    if (options.onProgress) this.progressListeners.set(downloadId, options.onProgress);

    const result = this.bridge
      .invoke<DownloadResult>('download', { ...request, downloadId })
      .catch((error: unknown) => {
        if (this.cancelled.delete(downloadId)) throw new DownloadCancelledError();
        throw error;
      })
      .finally(() => this.progressListeners.delete(downloadId));

    return {
      result,
      cancel: () => this.cancel(downloadId),
    };
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  /** Rejects every download native has not answered and stops listening for progress. */
  destroy(): void {
    this.progressListeners.clear();
    this.stopListening?.();
    this.stopListening = null;
    this.bridge.destroy();
  }

  private cancel(downloadId: string): void {
    if (this.cancelled.has(downloadId)) return;
    this.cancelled.add(downloadId);
    // What native answers is not waited for: the download it ends is what tells.
    void this.bridge.invoke('cancel_download', { downloadId }).catch(() => undefined);
  }

  private onEvent(event: unknown): void {
    const { type, downloadId, bytesWritten, totalBytes } = (event ?? {}) as Partial<DownloadEvent>;
    if (type !== 'progress' || downloadId === undefined) return;
    this.progressListeners.get(downloadId)?.({
      bytesWritten: bytesWritten ?? 0,
      totalBytes: totalBytes ?? -1,
    });
  }
}
