import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from '../utils/logger.js';
import { executeCommand } from '../utils/exec.js';
import { GyoError } from '../utils/errors.js';

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade Gyo CLI and project dependencies')
    .option('--check', 'Check for updates without upgrading')
    .option('--version <version>', 'Upgrade to specific version')
    .action(async (options) => {
      await runUpgrade(options);
    });
}

interface UpgradeOptions {
  check?: boolean;
  version?: string;
}

async function runUpgrade(options: UpgradeOptions): Promise<void> {
  try {
    logger.info('Checking for Gyo updates...\n');

    const { currentVersion, latestVersion } = await getVersionInfo();
    const targetVersion = options.version || latestVersion;

    displayVersionInfo(currentVersion, latestVersion);

    if (options.check) {
      handleCheckOnly(currentVersion, latestVersion);
      return;
    }

    if (currentVersion === targetVersion) {
      logger.success('\nAlready up to date!');
      return;
    }

    await performUpgrade(targetVersion);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Upgrade failed: ${message}`);
    throw new GyoError(message);
  }
}

async function getVersionInfo(): Promise<{ currentVersion: string; latestVersion: string }> {
  const cliPackageJson = await fs.readJson(path.join(__dirname, '../../package.json'));
  const currentVersion = cliPackageJson.version;

  const result = await executeCommand('npm', ['view', '@gyo-framework/cli', 'version'], {
    stdio: 'pipe'
  });

  if (!result.success) {
    throw new GyoError('Could not fetch latest version from npm');
  }

  return {
    currentVersion,
    latestVersion: result.stdout.trim()
  };
}

function displayVersionInfo(currentVersion: string, latestVersion: string): void {
  logger.info(`Current version: ${currentVersion}`);
  logger.info(`Latest version:  ${latestVersion}`);
}

function handleCheckOnly(currentVersion: string, latestVersion: string): void {
  if (currentVersion === latestVersion) {
    logger.success('\nYou are already on the latest version!');
  } else {
    logger.info(`\nA new version is available: ${latestVersion}`);
    logger.info('Run `gyo upgrade` to update');
  }
}

async function performUpgrade(targetVersion: string): Promise<void> {
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
