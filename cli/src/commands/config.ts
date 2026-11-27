import type { CommandMeta, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { loadConfig, setConfigValue } from '../services/config.service';
import { GyoError } from '../core/index';

export type ConfigAction = 'show' | 'set' | 'get';

interface ConfigCommandOptions extends BaseCommandOptions {
  action: ConfigAction;
  key?: string;
  value?: string;
}

export class ConfigCommand extends BaseCommand<ConfigCommandOptions> {
  static getSubcommands(): CommandMeta[] {
    return [
      {
        name: 'show',
        description: 'Show current configuration',
      },
      {
        name: 'set',
        arguments: '<key> <value>',
        description: 'Set a configuration value',
      },
      {
        name: 'get',
        arguments: '<key>',
        description: 'Get a configuration value',
      },
    ];
  }

  getMeta(): CommandMeta {
    return {
      name: 'config',
      description: 'Manage gyo configuration',
    };
  }

  protected async beforeRun(): Promise<void> {
    await this.requireGyoProject();
  }

  setAction(action: ConfigAction): void {
    this.options = { ...this.options, action };
  }

  setKeyValue(key: string, value?: string): void {
    this.options = { ...this.options, key, value };
  }

  protected async run(): Promise<void> {
    switch (this.options.action) {
      case 'show':
        await this.showConfig();
        break;
      case 'set':
        await this.setConfig();
        break;
      case 'get':
        await this.getConfig();
        break;
    }
  }

  private async showConfig(): Promise<void> {
    const config = await loadConfig(this.projectPath);

    logger.info('Current gyo configuration:\n');
    logger.log(JSON.stringify(config, null, 2));
  }

  private async setConfig(): Promise<void> {
    if (!this.options.key || this.options.value == null) {
      throw new GyoError('Key and value are required for set operation');
    }

    const { previous, next } = await setConfigValue(
      this.projectPath,
      this.options.key,
      this.options.value
    );
    const wasText = previous !== undefined ? ` (was: ${JSON.stringify(previous)})` : '';
    logger.success(`Set ${this.options.key} = ${next}${wasText}`);
  }

  private async getConfig(): Promise<void> {
    if (!this.options.key) {
      throw new GyoError('Key is required for get operation');
    }

    const config = await loadConfig(this.projectPath);

    const keys = this.options.key.split('.');
    let current: unknown = config;

    for (const k of keys) {
      if (typeof current !== 'object' || current === null || !(k in current)) {
        throw new GyoError(`Configuration key not found: ${this.options.key}`);
      }
      current = (current as Record<string, unknown>)[k];
    }

    logger.info(`${this.options.key} = ${JSON.stringify(current, null, 2)}`);
  }
}
