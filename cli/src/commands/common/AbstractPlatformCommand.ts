import ora from "ora";
import * as path from "path";
import { loadConfig, GyoConfig } from "../../utils/config.js";
import { logger } from "../../utils/logger.js";
import { pathExists } from "../../utils/fs.js";

export type Platform = "android" | "ios";

export interface BaseCommandOptions {
  profile: string;
}

export interface BuildCommandOptions extends BaseCommandOptions {
  release: boolean;
}

export interface RunCommandOptions extends BaseCommandOptions {
  device: string;
}

export abstract class AbstractPlatformCommand<
  T extends BaseCommandOptions = BaseCommandOptions
> {
  protected platform: Platform;
  protected options: T;
  protected spinner: ora.Ora;
  protected config: GyoConfig | null;
  protected projectPath: string;

  constructor(platform: Platform, options: T) {
    this.platform = platform;
    this.options = options;
    this.spinner = ora();
    this.config = null;
    this.projectPath = process.cwd();
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
      process.exit(1);
    }
  }

  protected abstract getValidPlatforms(): Platform[];

  protected async loadConfiguration(): Promise<void> {
    try {
      this.config = await loadConfig(this.projectPath);
    } catch (error) {
      this.spinner.fail("Failed to load gyo.config.json");
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

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
      process.exit(1);
    }
  }

  protected async checkPlatformExists(platform: string): Promise<void> {
    const platformPath = path.join(this.projectPath, platform);
    if (!(await pathExists(platformPath))) {
      this.spinner.fail(`${platform}/ directory not found`);
      logger.error(
        `Run 'gyo create' first to initialize the ${platform} platform`
      );
      process.exit(1);
    }
  }

  protected abstract run(): Promise<void>;

  protected handleError(error: unknown): void {
    this.spinner.fail("Command failed");
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
    process.exit(1);
  }
}
