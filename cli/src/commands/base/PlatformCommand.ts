import * as path from "path";
import { BaseCommand, BaseCommandOptions } from "./BaseCommand";
import { logger } from "../../utils/logger";
import { pathExists } from "../../utils/fs";
import {
  PlatformNotFoundError,
  PlatformDisabledError,
  GyoError,
  Platform,
} from "../../core/index";

export interface PlatformCommandOptions extends BaseCommandOptions {
  profile?: string;
}

export abstract class PlatformCommand<
  T extends PlatformCommandOptions = PlatformCommandOptions
> extends BaseCommand<T> {
  protected platform: Platform = "android";

  setPlatform(platform: Platform): void {
    this.platform = platform;
  }

  async execute(): Promise<void> {
    try {
      this.validatePlatform();
      await this.loadConfiguration();
      this.validatePlatformEnabled();
      await this.run();
    } catch (error) {
      this.handleError(error);
    }
  }

  protected validatePlatform(): void {
    const validPlatforms = this.getValidPlatforms();
    if (!validPlatforms.includes(this.platform)) {
      this.spinner.fail(`Invalid platform: ${this.platform}`);
      logger.error(`Valid platforms are: ${validPlatforms.join(", ")}`);
      throw new PlatformNotFoundError(this.platform);
    }
  }

  protected abstract getValidPlatforms(): Platform[];

  protected validatePlatformEnabled(): void {
    if (!this.config || !this.config.platforms) {
      return;
    }

    const platformConfig = this.config.platforms[this.platform];
    if (platformConfig && platformConfig.enabled === false) {
      this.spinner.fail(
        `Platform ${this.platform} is disabled in gyo.config.json`
      );
      logger.warn(
        `Enable it by setting platforms.${this.platform}.enabled to true`
      );
      throw new PlatformDisabledError(this.platform);
    }
  }

  protected async checkPlatformDirectoryExists(): Promise<void> {
    const platformPath = path.join(this.projectPath, this.platform);
    if (!(await pathExists(platformPath))) {
      this.spinner.fail(`${this.platform}/ directory not found`);
      logger.error(
        `Run 'gyo create' first to initialize the ${this.platform} platform`
      );
      throw new PlatformNotFoundError(this.platform);
    }
  }
}

export { Platform };
