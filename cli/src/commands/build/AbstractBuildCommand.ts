import * as path from 'path';
import { AbstractPlatformCommand, Platform, CommandOptions } from '../common/AbstractPlatformCommand';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists, writeFile } from '../../utils/fs';
import { getProfileUrl } from '../../utils/config';

export abstract class AbstractBuildCommand extends AbstractPlatformCommand {
  constructor(platform: Platform, options: CommandOptions = {}) {
    super(platform, options);
  }

  /**
   * Build commands support android and ios platforms.
   */
  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  /**
   * Main execution flow for build command.
   * Builds lib assets first, then runs platform-specific logic.
   */
  protected async run(): Promise<void> {
    const profile = this.options.profile || 'development';
    logger.info(`Building with profile: ${profile}`);

    // Build lib assets
    await this.buildLibAssets();

    // Build platform-specific app
    this.spinner.start(`Building ${this.platform} app...`);
    await this.buildPlatform();
  }

  protected async buildLibAssets(): Promise<void> {
    this.spinner.text = 'Building lib assets...';
    const libPath = path.join(this.projectPath, 'lib');

    if (await pathExists(libPath)) {
      const libBuildResult = await executeCommand('npm', ['run', 'build'], {
        cwd: libPath,
        stdio: 'pipe'
      });

      if (!libBuildResult.success) {
        this.spinner.fail('Lib build failed');
        logger.error(libBuildResult.stderr);
        process.exit(1);
      }

      this.spinner.succeed('Lib assets built successfully');
    } else {
      logger.warn('Lib directory not found, skipping lib build');
    }
  }

  protected getWebviewUrl(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    const profile = this.options.profile || 'development';
    return getProfileUrl(this.config, profile);
  }

  protected async writeConfigFile(configPath: string, webviewUrl: string): Promise<void> {
    this.spinner.text = `Configuring webview URL: ${webviewUrl}`;
    const fs = require('fs-extra');
    await fs.ensureDir(path.dirname(configPath));
    await writeFile(configPath, JSON.stringify({ webviewUrl }, null, 2));
  }

  protected abstract buildPlatform(): Promise<void>;
}
