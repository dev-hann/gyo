import * as path from 'path';
import type { CommandMeta, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { pathExists } from '../utils/fs';
import { GyoError, getErrorMessage } from '../core/index';
import {
  discoverPlugins,
  syncAndroidPlugins,
  generatePluginRegistry,
  updateMainActivity,
  writeManifest,
} from '../services/plugin.service';

export class InstallCommand extends BaseCommand<BaseCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: 'install',
      description: 'Sync Gyo plugin native code into platform projects',
      options: [
        {
          flags: '-p, --platform <platform>',
          description: 'Sync specific platform only (android, ios)',
        },
      ],
    };
  }

  protected async run(): Promise<void> {
    await this.requireGyoProject();
    const projectPath = this.projectPath;

    this.startSpinner('Scanning plugins...');

    const plugins = await discoverPlugins(projectPath);

    if (plugins.length === 0) {
      this.succeedSpinner('No Gyo plugins found in lib/node_modules/');
      logger.info('Install plugins with: cd lib && npm install @gyo-framework/<name>');
      return;
    }

    logger.info(`Found ${plugins.length} plugin(s):`);
    for (const plugin of plugins) {
      const platforms: string[] = [];
      if (plugin.hasAndroid) platforms.push('android');
      if (plugin.hasIOS) platforms.push('ios');
      logger.info(`  ${plugin.name}@${plugin.version} [${platforms.join(', ')}]`);
    }

    const platform = (this.options as BaseCommandOptions & { platform?: string }).platform;

    const androidPath = path.join(projectPath, 'android');
    const shouldSyncAndroid =
      (!platform || platform === 'android') && (await pathExists(androidPath));

    if (shouldSyncAndroid) {
      this.updateSpinner('Syncing Android plugins...');
      await syncAndroidPlugins(androidPath, plugins);
      await generatePluginRegistry(androidPath, plugins);

      const config = this.config;
      if (config?.platforms.android?.packageName) {
        await updateMainActivity(androidPath, config.platforms.android.packageName, plugins);
      } else {
        logger.warn('Could not determine package name. Update MainActivity.kt manually.');
      }

      logger.success('Android plugins synced');
    }

    await writeManifest(projectPath, plugins);

    this.succeedSpinner(`Synced ${plugins.length} plugin(s)`);
  }

  protected async handleError(error: unknown): Promise<void> {
    this.spinner.fail('Install failed');
    logger.error(getErrorMessage(error));
    if (error instanceof GyoError) {
      throw error;
    }
    throw new GyoError(getErrorMessage(error), 1, { cause: error });
  }
}
