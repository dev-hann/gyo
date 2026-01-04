import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig, GyoConfig } from '../utils/config.js';

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage gyo configuration');
  
  config
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      await showConfig();
    });
  
  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      await setConfig(key, value);
    });
  
  config
    .command('get <key>')
    .description('Get a configuration value')
    .action(async (key: string) => {
      await getConfig(key);
    });
}

async function showConfig(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    process.exit(1);
  }
  
  logger.info('Current gyo configuration:\n');
  console.log(JSON.stringify(config, null, 2));
}

async function setConfig(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    process.exit(1);
  }
  
  const keys = key.split('.');
  let current: any = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      logger.error(`Invalid configuration key: ${key}`);
      process.exit(1);
    }
    current = current[keys[i]];
  }
  
  const lastKey = keys[keys.length - 1];
  
  let parsedValue: any = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(Number(value))) parsedValue = Number(value);
  
  current[lastKey] = parsedValue;
  
  await saveConfig(config);
  logger.success(`Set ${key} = ${parsedValue}`);
}

async function getConfig(key: string): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    process.exit(1);
  }
  
  const keys = key.split('.');
  let current: any = config;
  
  for (const k of keys) {
    if (!(k in current)) {
      logger.error(`Configuration key not found: ${key}`);
      process.exit(1);
    }
    current = current[k];
  }
  
  logger.info(`${key} = ${JSON.stringify(current, null, 2)}`);
}
