import * as path from 'path';
import { AbstractBuildCommand } from './AbstractBuildCommand';
import type { CommandMeta } from '../base/BaseCommand';
import { logger } from '../../utils/logger';
import {
  executeCommand,
  requireTool,
  showYAMLParsingError,
  checkCommandExists,
} from '../../utils/exec';
import { BuildFailedError } from '../../core/errors';

export class IOSBuildCommand extends AbstractBuildCommand {
  getMeta(): CommandMeta {
    return { name: 'build-ios', description: 'Build iOS app' };
  }

  protected async buildPlatform(): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    await this.checkPlatformDirectoryExists();
    await this.checkXtoolAvailable();

    const serverUrl = this.getServerUrl();
    const configPath = path.join(iosPath, 'Sources/Resources/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl);

    await this.checkDeviceConnected();
    await this.buildApp(iosPath);
  }

  private async checkXtoolAvailable(): Promise<void> {
    await requireTool('xtool', 'Install xtool: https://xtool.sh');
  }

  private async checkDeviceConnected(): Promise<void> {
    const configuration = this.options.release ? 'Release' : 'Debug';
    this.updateSpinner(
      `Building iOS (${configuration})... Note: 'gyo build ios' will also install to connected device`
    );

    if (!(await checkCommandExists('idevice_id'))) {
      this.warnSpinner('idevice_id not found - cannot build iOS without connected device');
      logger.error('Install libimobiledevice or use a Mac with Xcode');
      throw new BuildFailedError('idevice_id not found');
    }

    const deviceCheckResult = await executeCommand('idevice_id', ['-l'], { stdio: 'pipe' });
    if (!deviceCheckResult.success || !deviceCheckResult.stdout.trim()) {
      this.failSpinner('No iOS device connected');
      logger.error('Connect an iOS device to build. xtool requires a device for building.');
      throw new BuildFailedError('No iOS device connected');
    }
  }

  private async buildApp(iosPath: string): Promise<void> {
    const result = await executeCommand('xtool', ['dev'], {
      cwd: iosPath,
      stdio: 'pipe',
    });

    if (result.success) {
      this.succeedSpinner('iOS build complete!');
      logger.verbose(result.stdout);
    } else {
      this.failSpinner('iOS build failed');
      const errorOutput = result.stderr || result.stdout || 'Unknown error';

      showYAMLParsingError(errorOutput);
      throw new BuildFailedError('iOS build failed');
    }
  }
}
