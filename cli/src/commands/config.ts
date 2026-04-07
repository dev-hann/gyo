import { BaseCommand, CommandMeta, BaseCommandOptions } from './base/index';
import { logger } from '../utils/logger';
import { loadConfig, saveConfig } from '../services/config.service';
import { GyoError } from '../core/index';

interface ConfigCommandOptions extends BaseCommandOptions {
  action: 'show' | 'set' | 'get';
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

  setAction(action: 'show' | 'set' | 'get'): void {
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

    const config = await loadConfig(this.projectPath);

    const keys = this.options.key.split('.');
    let current: Record<string, unknown> = config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        throw new GyoError(`Invalid configuration key: ${this.options.key}`);
      }
      current = current[keys[i]] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];

    const oldValue = current[lastKey];

    let parsedValue: string | number | boolean = this.options.value;
    const lowerValue = this.options.value.toLowerCase();
    if (['true', 'yes', '1', 'on'].includes(lowerValue)) parsedValue = true;
    else if (['false', 'no', '0', 'off'].includes(lowerValue)) parsedValue = false;
    else if (this.options.value.trim() !== '' && !isNaN(Number(this.options.value))) {
      parsedValue = Number(this.options.value);
    }

    current[lastKey] = parsedValue;

    await saveConfig(config, this.projectPath);
    const wasText = oldValue !== undefined ? ` (was: ${JSON.stringify(oldValue)})` : '';
    logger.success(`Set ${this.options.key} = ${parsedValue}${wasText}`);
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
