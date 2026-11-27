import type { CommandMeta, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { discoverPlugins, syncAndroidPlugins } from '../services/plugin.service';

interface InstallCommandOptions extends BaseCommandOptions {
  platform?: string;
}

export class InstallCommand extends BaseCommand<InstallCommandOptions> {
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

    this.startSpinner('Scanning plugins...');

    const plugins = await discoverPlugins(this.projectPath);

    if (plugins.length > 0) {
      logger.info(`Found ${plugins.length} plugin(s):`);
      for (const plugin of plugins) {
        const platforms: string[] = [];
        if (plugin.hasAndroid) platforms.push('android');
        if (plugin.hasIOS) platforms.push('ios');
        logger.info(`  ${plugin.name}@${plugin.version} [${platforms.join(', ')}]`);
      }
    }

    if (this.options.platform && this.options.platform !== 'android') {
      this.succeedSpinner(`Nothing to sync for ${this.options.platform}`);
      return;
    }

    // Runs even with no plugin: it also removes what an earlier sync left behind.
    this.updateSpinner('Syncing Android plugins...');
    await syncAndroidPlugins(this.projectPath, plugins);

    if (plugins.length === 0) {
      this.succeedSpinner('No Gyo plugins found in lib/node_modules/');
      logger.info('Install plugins with: cd lib && npm install @gyo-community/<name>');
      return;
    }

    this.succeedSpinner('Android plugins synced');
  }
}
