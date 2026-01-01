import * as path from 'path';
import { AbstractBuildCommand } from './AbstractBuildCommand';
import { logger } from '../../utils/logger';
import { executeCommand, checkCommandExists } from '../../utils/exec';

export class IOSBuildCommand extends AbstractBuildCommand {
  protected async buildPlatform(): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    await this.checkPlatformExists('ios');
    await this.checkXtoolAvailable();

    const webviewUrl = this.getWebviewUrl();
    const resourcesPath = path.join(iosPath, 'Sources/Resources');
    const configPath = path.join(resourcesPath, 'gyo-config.json');
    
    this.spinner.text = `Configuring webview URL: ${webviewUrl}`;
    const fs = require('fs-extra');
    await fs.ensureDir(resourcesPath);
    const configContent = JSON.stringify({ serverUrl: webviewUrl }, null, 2);
    await require('../../utils/fs').writeFile(configPath, configContent);

    await this.checkDeviceConnected();
    await this.buildApp(iosPath);
  }

  private async checkXtoolAvailable(): Promise<void> {
    if (!(await checkCommandExists('xtool'))) {
      this.spinner.fail('xtool not found');
      logger.error('Install xtool: https://xtool.sh');
      process.exit(1);
    }
  }

  private async checkDeviceConnected(): Promise<void> {
    const release = this.options.release || false;
    const configuration = release ? 'Release' : 'Debug';
    this.spinner.text = `Building iOS (${configuration})... Note: 'gyo build ios' will also install to connected device`;

    if (!(await checkCommandExists('idevice_id'))) {
      this.spinner.warn('idevice_id not found - cannot build iOS without connected device');
      logger.error('Install libimobiledevice or use a Mac with Xcode');
      process.exit(1);
    }

    const deviceCheckResult = await executeCommand('idevice_id', ['-l'], { stdio: 'pipe' });
    if (!deviceCheckResult.success || !deviceCheckResult.stdout.trim()) {
      this.spinner.fail('No iOS device connected');
      logger.error('Connect an iOS device to build. xtool requires a device for building.');
      process.exit(1);
    }
  }

  private async buildApp(iosPath: string): Promise<void> {
    const result = await executeCommand('xtool', ['dev'], {
      cwd: iosPath,
      stdio: 'inherit'
    });

    if (result.success) {
      this.spinner.succeed('iOS build complete!');
    } else {
      this.spinner.fail('iOS build failed');
      process.exit(1);
    }
  }
}
