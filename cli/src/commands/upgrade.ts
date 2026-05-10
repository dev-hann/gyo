import * as path from 'path';
import * as fs from 'fs-extra';
import type { CommandMeta, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { executeCommand } from '../utils/exec';
import { GyoError } from '../core/index';

interface UpgradeCommandOptions extends BaseCommandOptions {
  check?: boolean;
  version?: string;
}

export class UpgradeCommand extends BaseCommand<UpgradeCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: 'upgrade',
      description: 'Upgrade Gyo CLI and project dependencies',
      options: [
        { flags: '--check', description: 'Check for updates without upgrading' },
        { flags: '--version <version>', description: 'Upgrade to specific version' },
      ],
    };
  }

  protected async run(): Promise<void> {
    logger.info('Checking for Gyo updates...\n');

    const { currentVersion, latestVersion } = await this.getVersionInfo();
    const targetVersion = this.options.version || latestVersion;

    this.displayVersionInfo(currentVersion, latestVersion);

    if (this.options.check) {
      this.handleCheckOnly(currentVersion, latestVersion);
      return;
    }

    if (currentVersion === targetVersion) {
      logger.success('\nAlready up to date!');
      return;
    }

    await this.performUpgrade(targetVersion);
  }

  private async getVersionInfo(): Promise<{ currentVersion: string; latestVersion: string }> {
    const cliPackageJson = await fs.readJson(path.join(__dirname, '../../package.json'));
    const currentVersion = cliPackageJson.version;

    const result = await executeCommand('npm', ['view', '@gyo-framework/cli', 'version'], {
      stdio: 'pipe',
    });

    if (!result.success) {
      throw new GyoError('Could not fetch latest version from npm');
    }

    return {
      currentVersion,
      latestVersion: result.stdout.trim(),
    };
  }

  private displayVersionInfo(currentVersion: string, latestVersion: string): void {
    logger.info(`Current version: ${currentVersion}`);
    logger.info(`Latest version:  ${latestVersion}`);
  }

  private handleCheckOnly(currentVersion: string, latestVersion: string): void {
    if (currentVersion === latestVersion) {
      logger.success('\nYou are already on the latest version!');
    } else {
      logger.info(`\nA new version is available: ${latestVersion}`);
      logger.info('Run `gyo upgrade` to update');
    }
  }

  private async performUpgrade(targetVersion: string): Promise<void> {
    logger.info(`\nUpgrading to ${targetVersion}...\n`);

    logger.info('Updating CLI...');
    const upgradeResult = await executeCommand(
      'npm',
      ['install', '-g', `@gyo-framework/cli@${targetVersion}`],
      { stdio: 'inherit' }
    );

    if (!upgradeResult.success) {
      throw new GyoError('Failed to upgrade CLI');
    }

    logger.success(`\nSuccessfully upgraded to v${targetVersion}!`);
    logger.info('\nRun `gyo --version` to verify the installation');
  }
}
