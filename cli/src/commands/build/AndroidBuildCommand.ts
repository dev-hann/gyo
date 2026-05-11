import * as path from 'path';
import { AbstractBuildCommand } from './AbstractBuildCommand';
import type { CommandMeta } from '../base/BaseCommand';
import { logger } from '../../utils/logger';
import { executeCommand, getGradlew } from '../../utils/exec';
import { BuildFailedError } from '../../core/errors';
import { readFile, pathExists } from '../../utils/fs';
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

    const serverUrl = this.getServerUrl();
    const configPath = path.join(androidPath, 'app/src/main/assets/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl);

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

  private async checkSigningConfig(androidPath: string): Promise<void> {
    const gradlePath = path.join(androidPath, 'app', 'build.gradle');
    if (!(await pathExists(gradlePath))) return;

    const content = await readFile(gradlePath);
    if (!content.includes('storeFile')) {
      const signingMessage = [
        'Release signing not configured.',
        'Add a signing config to android/app/build.gradle:',
        '  android { signingConfigs { release {',
        '    storeFile file("keystore.jks")',
        '    storePassword "..."',
        '    keyAlias "..."',
        '    keyPassword "..."',
        '  } } }',
        'See: https://developer.android.com/build/configure-apk-signing',
      ].join('\n');
      logger.error(signingMessage);
      throw new BuildFailedError('Release signing config not found in build.gradle');
    }
  }

  private async buildApp(androidPath: string): Promise<void> {
    const task = this.options.release ? 'assembleRelease' : 'assembleDebug';
    const gradlew = getGradlew();

    if (this.options.release) {
      await this.checkSigningConfig(androidPath);
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
