import { Command } from 'commander';
import { Platform } from './common/AbstractPlatformCommand';
import { AndroidBuildCommand } from './build/AndroidBuildCommand';
import { IOSBuildCommand } from './build/IOSBuildCommand';

export function registerBuildCommand(program: Command): void {
  program
    .command('build <platform>')
    .description('Build the native application for the specified platform')
    .option('-r, --release', 'Build for release (production)', false)
    .option('-p, --profile <profile>', 'Build profile to use (development, production, etc.)', 'development')
    .action(async (platform: string, options: { release: boolean; profile?: string }) => {
      await buildPlatform(platform as Platform, options);
    });
}

async function buildPlatform(platform: Platform, options: { release: boolean; profile?: string }): Promise<void> {
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
