import * as path from 'path';
import { AbstractBuildCommand } from './AbstractBuildCommand';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';

export class AndroidBuildCommand extends AbstractBuildCommand {
  protected async buildPlatform(): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    await this.checkPlatformExists('android');

    const serverUrl = this.getServerUrl();
    const configPath = path.join(androidPath, 'app/src/main/assets/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl);

    await this.buildApp(androidPath);
  }

  private async buildApp(androidPath: string): Promise<void> {
    const task = this.options.release ? 'assembleRelease' : 'assembleDebug';
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

    this.spinner.text = `Running ${task}...`;

    const result = await executeCommand(gradlew, [task], {
      cwd: androidPath,
      stdio: 'pipe'
    });

    if (result.success) {
      this.spinner.succeed('Android build complete!');
      const apkPath = this.options.release
        ? 'android/app/build/outputs/apk/release/app-release.apk'
        : 'android/app/build/outputs/apk/debug/app-debug.apk';
      logger.info(`APK location: ${apkPath}`);
      logger.verbose(result.stdout);
    } else {
      this.spinner.fail('Android build failed');
      logger.error(result.stderr || result.stdout);
      process.exit(1);
    }
  }
}
