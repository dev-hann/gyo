import { Bridge } from '@gyo-framework/bridge';
import type { InstallApkParams } from './types';

const BRIDGE_NAME = 'app_launcher';

/**
 * Installs an APK with Android's installer, for an app that is not in a
 * store: the page has the new version downloaded into the cache of the app
 * (`Downloader` of `@gyo-community/http`) and hands its path here.
 */
export class ApkInstaller {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge(BRIDGE_NAME);
  }

  /**
   * Whether the app may install an APK. On Android 8 and later the reader
   * allows that in the settings; an app that was never refused answers true.
   */
  canInstall(): Promise<boolean> {
    return this.bridge.invoke<boolean>('can_install_apk');
  }

  /** Opens the settings where the reader allows the app to install APKs. Tells whether they opened. */
  openInstallSettings(): Promise<boolean> {
    return this.bridge.invoke<boolean>('open_install_settings');
  }

  /**
   * Asks Android's installer to install the file at `path`, which is in the
   * cache of the app. Tells whether the installer was started; what the
   * reader does there is not reported.
   */
  install(params: InstallApkParams): Promise<boolean> {
    return this.bridge.invoke<boolean>('install_apk', params);
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
