import * as path from 'path';
import { AbstractPlatformCommand, Platform, BuildCommandOptions } from '../common/AbstractPlatformCommand';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists, writeFile } from '../../utils/fs';
import { getProfileUrl } from '../../utils/config';

export abstract class AbstractBuildCommand extends AbstractPlatformCommand<BuildCommandOptions> {
  constructor(platform: Platform, options: BuildCommandOptions) {
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
    logger.info(`Building with profile: ${this.options.profile}`);

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
        logger.error(libBuildResult.stderr || libBuildResult.stdout);
        process.exit(1);
      }

      this.spinner.succeed('Lib assets built successfully');
      logger.verbose(libBuildResult.stdout);
    } else {
      logger.warn('Lib directory not found, skipping lib build');
    }
  }

  protected getServerUrl(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return getProfileUrl(this.config, this.options.profile);
  }

  protected async writeConfigFile(configPath: string, serverUrl: string): Promise<void> {
    this.spinner.text = `Configuring server URL: ${serverUrl}`;
    const fs = require('fs-extra');
    await fs.ensureDir(path.dirname(configPath));
    await writeFile(configPath, JSON.stringify({ serverUrl }, null, 2));
  }

  protected abstract buildPlatform(): Promise<void>;
}
