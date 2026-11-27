import type { CommandMeta, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { executeCommand } from '../utils/exec';
import { getCliVersion } from '../utils/paths';
import { GyoError, compareVersions } from '../core/index';

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

    this.displayVersionInfo(currentVersion, latestVersion);

    if (this.options.check) {
      this.reportCheck(latestVersion, currentVersion);
      return;
    }

    // A version asked for by name is installed whatever it is: an older one
    // is a downgrade on purpose. What npm calls latest is installed only
    // when it is newer, so a local build is not replaced by it.
    const askedFor = this.options.version;
    const targetVersion = askedFor ?? latestVersion;
    const upToDate =
      askedFor !== undefined
        ? askedFor === currentVersion
        : compareVersions(targetVersion, currentVersion) <= 0;
    if (upToDate) {
      logger.success('\nAlready up to date!');
      return;
    }

    await this.performUpgrade(targetVersion);
  }

  private async getVersionInfo(): Promise<{ currentVersion: string; latestVersion: string }> {
    const result = await executeCommand('npm', ['view', '@gyo-framework/cli', 'version'], {
      stdio: 'pipe',
    });

    if (!result.success) {
      throw new GyoError('Could not fetch latest version from npm');
    }

    return {
      currentVersion: getCliVersion(),
      latestVersion: result.stdout.trim(),
    };
  }

  private displayVersionInfo(currentVersion: string, latestVersion: string): void {
    logger.info(`Current version: ${currentVersion}`);
    logger.info(`Latest version:  ${latestVersion}`);
  }

  private reportCheck(latestVersion: string, currentVersion: string): void {
    if (compareVersions(latestVersion, currentVersion) <= 0) {
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
