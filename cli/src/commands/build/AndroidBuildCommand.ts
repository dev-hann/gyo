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
import {
  discoverPlugins,
  syncAndroidPlugins,
  generatePluginRegistry,
  updateMainActivity,
  writeManifest,
  readManifest,
  needsSync,
} from '../../services/plugin.service';

export class AndroidBuildCommand extends AbstractBuildCommand {
  getMeta(): CommandMeta {
    return { name: 'build-android', description: 'Build Android APK' };
  }

  protected async buildPlatform(): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    await this.checkPlatformDirectoryExists();

    await this.syncPluginsIfNeeded(androidPath);

    if (!this.config) {
      throw new GyoError('Configuration not loaded');
    }
    await syncAndroidAppIdentity(androidPath, toAndroidAppIdentity(this.config, this.projectPath));

    const serverUrl = this.getServerUrl();
    const configPath = path.join(androidPath, 'app/src/main/assets/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl, this.config.webview);

    await this.buildApp(androidPath);
  }

  private async syncPluginsIfNeeded(androidPath: string): Promise<void> {
    try {
      const plugins = await discoverPlugins(this.projectPath);
      const manifest = await readManifest(this.projectPath);

      if (!needsSync(manifest, plugins)) {
        logger.verbose('Plugins up to date, skipping sync');
        return;
      }

      if (plugins.length > 0) {
        logger.info('Plugin changes detected, re-syncing...');
        await syncAndroidPlugins(androidPath, plugins);
        await generatePluginRegistry(androidPath, plugins);

        const config = this.config;
        if (config?.platforms.android?.packageName) {
          await updateMainActivity(androidPath, config.platforms.android.packageName, plugins);
        }

        await writeManifest(this.projectPath, plugins);
        logger.verbose(`Synced ${plugins.length} plugin(s)`);
      }
    } catch (e) {
      logger.warn(`Plugin sync failed: ${e instanceof Error ? e.message : String(e)}`);
      logger.warn('Continuing build without plugin sync...');
    }
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
