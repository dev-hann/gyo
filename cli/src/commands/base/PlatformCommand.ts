import * as path from 'path';
import type { BaseCommandOptions } from './BaseCommand';
import { BaseCommand } from './BaseCommand';
import { logger } from '../../utils/logger';
import { pathExists, ensureDir, writeFile } from '../../utils/fs';
import type { Platform } from '../../core/index';
import { PlatformNotFoundError, PlatformDisabledError } from '../../core/index';

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

  async execute(): Promise<void> {
    try {
      await this.beforeRun();
      await this.run();
    } catch (error) {
      await this.handleError(error);
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
      this.spinner.fail(`Invalid platform: ${this.platform}`);
      logger.error(`Valid platforms are: ${validPlatforms.join(', ')}`);
      throw new PlatformNotFoundError(this.platform);
    }
  }

  protected abstract getValidPlatforms(): Platform[];

  protected validatePlatformEnabled(): void {
    if (this.config == null) {
      return;
    }

    const platformConfig = this.config.platforms[this.platform];
    if (platformConfig && platformConfig.enabled === false) {
      this.spinner.fail(`Platform ${this.platform} is disabled in gyo.config.json`);
      logger.warn(`Enable it by setting platforms.${this.platform}.enabled to true`);
      throw new PlatformDisabledError(this.platform);
    }
  }

  protected async checkPlatformDirectoryExists(): Promise<void> {
    const platformPath = path.join(this.projectPath, this.platform);
    if (!(await pathExists(platformPath))) {
      this.spinner.fail(`'${this.platform}/' directory not found`);
      logger.error(
        `Run 'gyo create' first to initialize the project, or check you're in the correct directory.`
      );
      throw new PlatformNotFoundError(this.platform);
    }
  }

  protected async writeConfigFile(configPath: string, serverUrl: string): Promise<void> {
    this.updateSpinner(`Configuring server URL: ${serverUrl}`);
    await ensureDir(path.dirname(configPath));
    await writeFile(configPath, JSON.stringify({ serverUrl }, null, 2));
  }
}

export type { Platform };
