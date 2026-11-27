import * as path from 'path';
import type { BaseCommandOptions } from './BaseCommand';
import { BaseCommand } from './BaseCommand';
import { pathExists, ensureDir, writeFile } from '../../utils/fs';
import type { GyoConfig, Platform } from '../../core/index';
import {
  InvalidPlatformError,
  PlatformNotFoundError,
  PlatformDisabledError,
  toWebViewSettings,
} from '../../core/index';

export interface PlatformCommandOptions extends BaseCommandOptions {
  profile?: string;
}

export abstract class PlatformCommand<
  T extends PlatformCommandOptions = PlatformCommandOptions,
> extends BaseCommand<T> {
  protected platform: Platform = 'android';

  setPlatform(platform: Platform): void {
    this.platform = platform;
  }

  setPositionalArgs([platform]: string[]): void {
    if (platform) {
      this.setPlatform(platform as Platform);
    }
  }

  protected async beforeRun(): Promise<void> {
    this.validatePlatform();
    await this.requireGyoProject();
    await this.loadConfiguration();
    this.validatePlatformEnabled();
  }

  async runDirectly(): Promise<void> {
    await this.beforeRun();
    await this.run();
  }

  protected validatePlatform(): void {
    const validPlatforms = this.getValidPlatforms();
    if (!validPlatforms.includes(this.platform)) {
      throw new InvalidPlatformError(this.platform, validPlatforms);
    }
  }

  protected abstract getValidPlatforms(): Platform[];

  protected validatePlatformEnabled(): void {
    if (this.config == null) {
      return;
    }

    const platformConfig = this.config.platforms[this.platform];
    if (platformConfig && platformConfig.enabled === false) {
      throw new PlatformDisabledError(this.platform);
    }
  }

  protected async checkPlatformDirectoryExists(): Promise<void> {
    const platformPath = path.join(this.projectPath, this.platform);
    if (!(await pathExists(platformPath))) {
      throw new PlatformNotFoundError(this.platform, this.projectPath);
    }
  }

  /**
   * Bakes the runtime config the native shell reads. `webview` carries only
   * the settings the shell has to apply.
   */
  protected async writeConfigFile(
    configPath: string,
    serverUrl: string,
    webview?: GyoConfig['webview']
  ): Promise<void> {
    this.updateSpinner(`Configuring server URL: ${serverUrl}`);
    await ensureDir(path.dirname(configPath));
    const settings = toWebViewSettings(webview);
    const config: Record<string, unknown> = { serverUrl };
    if (settings) {
      config.webview = settings;
    }
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
}

export type { Platform };
