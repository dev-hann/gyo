import type { CommandMeta, Platform } from './base/index';
import { BaseCommand } from './base/index';
import { AndroidBuildCommand } from './build/AndroidBuildCommand';
import { IOSBuildCommand } from './build/IOSBuildCommand';
import { InvalidPlatformError } from '../core/index';

interface BuildCommandOptions {
  profile: string;
  release: boolean;
  verbose?: boolean;
}

export class BuildCommand extends BaseCommand<BuildCommandOptions> {
  private platform: Platform = 'android';

  getMeta(): CommandMeta {
    return {
      name: 'build <platform>',
      description: 'Build the native application for the specified platform',
      positionalHandler: 'platform',
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

  setPlatform(platform: Platform): void {
    this.platform = platform;
  }

  protected async run(): Promise<void> {
    const command = this.createCommand(this.platform);
    command.setOptions(this.options);
    await command.runDirectly();
  }

  private createCommand(platform: Platform): AndroidBuildCommand | IOSBuildCommand {
    switch (platform) {
      case 'android':
        return new AndroidBuildCommand();
      case 'ios':
        return new IOSBuildCommand();
      default:
        throw new InvalidPlatformError(platform, ['android', 'ios']);
    }
  }
}
