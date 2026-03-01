import { BaseCommand, CommandMeta, BaseCommandOptions } from './base/index.js';
import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig } from '../services/config.service.js';
import { GyoError } from '../core/index.js';

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
    if (!config) {
      throw new GyoError('Configuration not found');
    }

    logger.info('Current gyo configuration:\n');
    console.log(JSON.stringify(config, null, 2));
  }

  private async setConfig(): Promise<void> {
    if (!this.options.key || this.options.value === undefined) {
      throw new GyoError('Key and value are required for set operation');
    }

    const config = await loadConfig(this.projectPath);
    if (!config) {
      throw new GyoError('Configuration not found');
    }

    const keys = this.options.key.split('.');
    let current: Record<string, unknown> = config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        throw new GyoError(`Invalid configuration key: ${this.options.key}`);
      }
      current = current[keys[i]] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];

    let parsedValue: string | number | boolean = this.options.value;
    if (this.options.value === 'true') parsedValue = true;
    else if (this.options.value === 'false') parsedValue = false;
    else if (!isNaN(Number(this.options.value))) parsedValue = Number(this.options.value);

    current[lastKey] = parsedValue;

    await saveConfig(config, this.projectPath);
    logger.success(`Set ${this.options.key} = ${parsedValue}`);
  }

  private async getConfig(): Promise<void> {
    if (!this.options.key) {
      throw new GyoError('Key is required for get operation');
    }

    const config = await loadConfig(this.projectPath);
    if (!config) {
      throw new GyoError('Configuration not found');
    }

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
