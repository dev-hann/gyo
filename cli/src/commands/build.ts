import type { CommandMeta, Platform, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { InvalidPlatformError } from '../core/index';
import { AndroidBuildCommand } from './build/AndroidBuildCommand';
import { IOSBuildCommand } from './build/IOSBuildCommand';
import type { AbstractBuildCommand } from './build/AbstractBuildCommand';

interface BuildCommandOptions extends BaseCommandOptions {
  profile: string;
  release: boolean;
}

/** The command that builds each platform, by platform. */
const BUILD_COMMANDS: Record<Platform, new () => AbstractBuildCommand> = {
  android: AndroidBuildCommand,
  ios: IOSBuildCommand,
};

export class BuildCommand extends BaseCommand<BuildCommandOptions> {
  private platform: Platform = 'android';

  getMeta(): CommandMeta {
    return {
      name: 'build',
      description: 'Build the native application for the specified platform',
      arguments: '<platform>',
      options: [
        { flags: '-r, --release', description: 'Build for release (production)', default: false },
        {
          flags: '-p, --profile <profile>',
          description: 'Build profile to use',
          default: 'development',
        },
        { flags: '-v, --verbose', description: 'Show detailed logs' },
      ],
    };
  }

  setPositionalArgs([platform]: string[]): void {
    this.platform = platform as Platform;
  }

  protected async beforeRun(): Promise<void> {
    if (!(this.platform in BUILD_COMMANDS)) {
      throw new InvalidPlatformError(this.platform, Object.keys(BUILD_COMMANDS));
    }
  }

  protected async run(): Promise<void> {
    const command = new BUILD_COMMANDS[this.platform]();

    command.setPlatform(this.platform);
    command.setOptions(this.options);
    await command.runDirectly();
  }
}
