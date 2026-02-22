import { BaseCommand, BaseCommandOptions } from "./BaseCommand.js";
import { InvalidPlatformError, GyoError } from "../../core/index.js";

export type MultiPlatform = string;

export interface MultiPlatformCommandOptions extends BaseCommandOptions {
  platform?: string;
}

export abstract class MultiPlatformCommand<
  T extends MultiPlatformCommandOptions = MultiPlatformCommandOptions
> extends BaseCommand<T> {
  protected platform: MultiPlatform = "all";

  setPlatform(platform: MultiPlatform): void {
    this.platform = platform;
  }

  async execute(): Promise<void> {
    try {
      this.validatePlatform();
      await this.run();
    } catch (error) {
      this.handleError(error);
    }
  }

  protected validatePlatform(): void {
    const validPlatforms = this.getValidPlatforms();
    if (!validPlatforms.includes(this.platform)) {
      this.spinner.fail(`Invalid platform: ${this.platform}`);
      throw new InvalidPlatformError(this.platform, validPlatforms.filter(p => p !== "all"));
    }
  }

  protected abstract getValidPlatforms(): MultiPlatform[];

  protected getPlatformsToProcess(): string[] {
    const validPlatforms = this.getValidPlatforms().filter(p => p !== "all");
    return this.platform === "all" ? validPlatforms : [this.platform];
  }

  protected async processAllPlatforms(
    processor: (platform: string) => Promise<void>
  ): Promise<void> {
    const platforms = this.getPlatformsToProcess();
    await Promise.all(platforms.map(p => processor(p)));
  }

  protected async processPlatformsSequentially(
    processor: (platform: string) => Promise<void>
  ): Promise<void> {
    const platforms = this.getPlatformsToProcess();
    for (const platform of platforms) {
      await processor(platform);
    }
  }
}
