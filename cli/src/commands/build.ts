import { Command } from 'commander';
import { Platform, BuildCommandOptions } from './common/AbstractPlatformCommand';
import { AndroidBuildCommand } from './build/AndroidBuildCommand';
import { IOSBuildCommand } from './build/IOSBuildCommand';
import { logger } from '../utils/logger';

export function registerBuildCommand(program: Command): void {
  program
    .command('build <platform>')
    .description('Build the native application for the specified platform')
    .option('-r, --release', 'Build for release (production)', false)
    .option('-p, --profile <profile>', 'Build profile to use (development, production, etc.)', 'development')
    .option('-v, --verbose', 'Show detailed logs')
    .action(async (platform: string, rawOptions: { release: boolean; profile: string; verbose?: boolean }) => {
      if (rawOptions.verbose) {
        logger.setVerbose(true);
      }
      
      const options: BuildCommandOptions = {
        profile: rawOptions.profile,
        release: rawOptions.release
      };
      
      await buildPlatform(platform as Platform, options);
    });
}

async function buildPlatform(platform: Platform, options: BuildCommandOptions): Promise<void> {
  let command;

  switch (platform) {
    case 'android':
      command = new AndroidBuildCommand(platform, options);
      break;
    case 'ios':
      command = new IOSBuildCommand(platform, options);
      break;
    default:
      // Invalid platform - let the command's validation handle it
      command = new AndroidBuildCommand(platform, options);
      break;
  }

  await command.execute();
}
