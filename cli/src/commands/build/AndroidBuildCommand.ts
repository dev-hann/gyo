import * as path from 'path';
import { AbstractBuildCommand } from './AbstractBuildCommand';
import type { CommandMeta } from '../base/BaseCommand';
import { logger } from '../../utils/logger';
import { executeCommand, getGradlew } from '../../utils/exec';
import { BuildFailedError, GyoError } from '../../core/errors';
import {
  prepareReleaseSigning,
  syncAndroidAppIdentity,
  toAndroidAppIdentity,
} from '../../services/android-shell.service';
import { syncAndroidPluginsIfNeeded } from '../../services/plugin.service';

export class AndroidBuildCommand extends AbstractBuildCommand {
  getMeta(): CommandMeta {
    return { name: 'build-android', description: 'Build Android APK' };
  }

  protected async buildPlatform(): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    await this.checkPlatformDirectoryExists();
    await syncAndroidPluginsIfNeeded(this.projectPath);

    if (!this.config) {
      throw new GyoError('Configuration not loaded');
    }
    await syncAndroidAppIdentity(androidPath, toAndroidAppIdentity(this.config, this.projectPath));

    const serverUrl = this.getServerUrl();
    const configPath = path.join(androidPath, 'app/src/main/assets/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl, this.config.webview);

    await this.buildApp(androidPath);
  }

  private async buildApp(androidPath: string): Promise<void> {
    const task = this.options.release ? 'assembleRelease' : 'assembleDebug';
    const gradlew = getGradlew();

    if (this.options.release) {
      await prepareReleaseSigning(androidPath);
    }

    this.updateSpinner(`Running ${task}...`);

    const result = await executeCommand(gradlew, [task], {
      cwd: androidPath,
      stdio: 'pipe',
    });

    if (result.success) {
      this.succeedSpinner('Android build complete!');
      const apkPath = this.options.release
        ? 'android/app/build/outputs/apk/release/app-release.apk'
        : 'android/app/build/outputs/apk/debug/app-debug.apk';
      logger.info(`APK location: ${apkPath}`);
      logger.verbose(result.stdout);
    } else {
      this.failSpinner('Android build failed');
      logger.error(result.stderr || result.stdout);
      throw new BuildFailedError('Android build failed');
    }
  }
}
