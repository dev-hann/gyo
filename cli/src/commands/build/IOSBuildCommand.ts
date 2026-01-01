import * as path from 'path';
import { AbstractBuildCommand } from './AbstractBuildCommand';
import { logger } from '../../utils/logger';
import { executeCommand, checkCommandExists } from '../../utils/exec';

export class IOSBuildCommand extends AbstractBuildCommand {
  protected async buildPlatform(): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    await this.checkPlatformExists('ios');
    await this.checkXtoolAvailable();

    const serverUrl = this.getServerUrl();
    const configPath = path.join(iosPath, 'Sources/Resources/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl);

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
    const configuration = this.options.release ? 'Release' : 'Debug';
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
      stdio: 'pipe'
    });

    if (result.success) {
      this.spinner.succeed('iOS build complete!');
      logger.verbose(result.stdout);
    } else {
      this.spinner.fail('iOS build failed');
      const errorOutput = result.stderr || result.stdout || 'Unknown error';
      
      // Check for common YAML parsing errors
      if (errorOutput.includes('typeMismatch') || errorOutput.includes('Expected to decode Scalar')) {
        logger.error('YAML parsing error in xtool.yml or project.yml');
        logger.error('Common issues:');
        logger.error('  1. bundleID should be a simple string value, not a mapping');
        logger.error('     ✓ Correct:   bundleID: com.example.app');
        logger.error('     ✗ Wrong:     bundleID:');
        logger.error('                    key: value');
        logger.error('  2. Check for unintended indentation or special characters');
        logger.error(`\nFull error:\n${errorOutput}`);
      } else {
        logger.error(errorOutput);
      }
      process.exit(1);
    }
  }
}
