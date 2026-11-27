import * as path from 'path';
import type { PlatformCommandOptions } from '../base/index';
import { PlatformCommand } from '../base/index';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists } from '../../utils/fs';
import { saveConfig, shouldStartLocalServer } from '../../services/config.service';
import { WebServerService } from '../../services/web-server.service';
import { BuildFailedError, GyoError } from '../../core/errors';
import { namedHostOf } from '../../core/url';
import inquirer from 'inquirer';

export interface BuildCommandOptions extends PlatformCommandOptions {
  profile: string;
  release: boolean;
}

export abstract class AbstractBuildCommand extends PlatformCommand<BuildCommandOptions> {
  protected serverUrl: string = '';

  protected readonly webServerService = new WebServerService();

  protected async run(): Promise<void> {
    logger.info(`Building with profile: ${this.options.profile}`);

    this.serverUrl = await this.resolveServerUrl();

    await this.buildLibAssets();

    this.startSpinner(`Building ${this.platform} app...`);
    await this.buildPlatform();
  }

  /**
   * Resolves the server URL for the build:
   * 1. Use profiles.<profile>.serverUrl from gyo.config.json when set
   * 2. Otherwise prompt for the deploy URL and save it to the config
   */
  protected async resolveServerUrl(): Promise<string> {
    const existing = this.config.profiles?.[this.options.profile]?.serverUrl.trim();
    if (existing) {
      return this.toDeviceUrl(existing);
    }

    if (!process.stdin.isTTY) {
      const available = this.config.profiles ? Object.keys(this.config.profiles) : [];
      throw new GyoError(
        `Profile '${this.options.profile}' has no serverUrl in gyo.config.json. ` +
          `Set it manually (profiles.${this.options.profile}.serverUrl) and retry. ` +
          `Available profiles: ${available.length > 0 ? available.join(', ') : 'none'}`
      );
    }

    logger.info(
      `Profile '${this.options.profile}' has no serverUrl configured.` +
        ' Deploy your web app to a server first, then enter its URL.'
    );

    const { url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: `Deploy URL for profile '${this.options.profile}':`,
        validate: (value: string) =>
          /^https?:\/\/.+/.test(value.trim()) || 'URL must start with http:// or https://',
      },
    ]);

    const serverUrl = (url as string).trim();

    if (!this.config.profiles) {
      this.config.profiles = {};
    }
    this.config.profiles[this.options.profile] = { serverUrl };
    await saveConfig(this.config, this.projectPath);
    logger.info(`Saved profiles.${this.options.profile}.serverUrl to gyo.config.json`);

    return this.toDeviceUrl(serverUrl);
  }

  /**
   * `localhost` reaches the build machine only, and a development build is
   * installed on a device. Point it at the machine's LAN address instead, as
   * `gyo run` does. `gyo run` does not store that address in the config.
   */
  protected async toDeviceUrl(serverUrl: string): Promise<string> {
    if (!shouldStartLocalServer(this.options.profile) || namedHostOf(serverUrl)) {
      return serverUrl;
    }
    return this.webServerService.resolveServerUrl(serverUrl);
  }

  protected getServerUrl(): string {
    return this.serverUrl;
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

  protected abstract buildPlatform(): Promise<void>;
}
