import * as path from 'path';
import { PlatformCommand, Platform, PlatformCommandOptions } from '../base/index';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists, writeFile, ensureDir } from '../../utils/fs';
import { getProfileUrl } from '../../services/config.service';
import { BuildFailedError, GyoError } from '../../core/errors';

export interface BuildCommandOptions extends PlatformCommandOptions {
  profile: string;
  release: boolean;
}

export abstract class AbstractBuildCommand extends PlatformCommand<BuildCommandOptions> {
  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  protected async run(): Promise<void> {
    logger.info(`Building with profile: ${this.options.profile}`);

    await this.buildLibAssets();

    this.startSpinner(`Building ${this.platform} app...`);
    await this.buildPlatform();
  }

  protected async buildLibAssets(): Promise<void> {
    this.updateSpinner('Building lib assets...');
    const libPath = path.join(this.projectPath, 'lib');
    const pkgPath = path.join(libPath, 'package.json');

    if (!(await pathExists(libPath)) || !(await pathExists(pkgPath))) {
      logger.warn('lib/ directory or package.json not found, skipping lib build');
      logger.warn("Run 'gyo create' to scaffold a project with a web application.");
      return;
    }

    const libBuildResult = await executeCommand('npm', ['run', 'build'], {
      cwd: libPath,
      stdio: 'pipe',
    });

    if (!libBuildResult.success) {
      this.failSpinner('Lib build failed');
      logger.error(libBuildResult.stderr || libBuildResult.stdout);
      throw new BuildFailedError('Lib build failed');
    }

    this.succeedSpinner('Lib assets built successfully');
    logger.verbose(libBuildResult.stdout);
  }

  protected getServerUrl(): string {
    if (!this.config) {
      throw new GyoError('Configuration not loaded');
    }
    return getProfileUrl(this.config, this.options.profile);
  }

  protected async writeConfigFile(configPath: string, serverUrl: string): Promise<void> {
    this.updateSpinner(`Configuring server URL: ${serverUrl}`);
    await ensureDir(path.dirname(configPath));
    await writeFile(configPath, JSON.stringify({ serverUrl }, null, 2));
  }

  protected abstract buildPlatform(): Promise<void>;
}
