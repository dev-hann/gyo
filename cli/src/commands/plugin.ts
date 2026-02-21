import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import ora from 'ora';
import { logger } from '../utils/logger.js';
import { PluginManager } from '../utils/plugin-manager.js';
import { pathExists } from '../utils/fs.js';
import { GyoError, PluginError } from '../utils/errors.js';

export function registerPluginCommand(program: Command): void {
  const plugin = program
    .command('plugin')
    .description('Manage gyo plugins');

  plugin
    .command('list')
    .description('List installed plugins')
    .action(async () => {
      await listPlugins();
    });

  plugin
    .command('clean')
    .description('Clean plugin cache')
    .option('--all', 'Remove all cached plugins')
    .action(async (options: { all?: boolean }) => {
      await cleanPluginCache(options);
    });

  plugin
    .command('validate')
    .description('Validate plugin configurations')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (options: { verbose?: boolean }) => {
      if (options.verbose) {
        logger.setVerbose(true);
      }
      await validatePlugins();
    });
}

async function listPlugins(): Promise<void> {
  const spinner = ora('Reading plugin manifest...').start();

  try {
    const manager = new PluginManager();
    const manifest = await manager.readManifest();

    if (!manifest || Object.keys(manifest.plugins).length === 0) {
      spinner.info('No plugins installed');
      showAddPluginHint();
      return;
    }

    spinner.succeed('Plugin manifest loaded');
    logger.log('');

    displayPlugins(manifest.plugins);

    logger.log(`Generated: ${new Date(manifest.generatedDate).toLocaleString()}`);
    logger.log(`Gyo Version: ${manifest.gyoVersion}`);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail('Failed to read plugin manifest');
    throw new PluginError(message);
  }
}

function displayPlugins(plugins: Record<string, { version: string; platforms: { android?: boolean; ios?: boolean } }>): void {
  const entries = Object.entries(plugins);
  const official = entries.filter(([name]) => name.startsWith('@gyo-framework/'));
  const community = entries.filter(([name]) => name.startsWith('@gyo-community/'));

  if (official.length > 0) {
    displayPluginGroup(`📦 Official Plugins (${official.length})`, official);
  }

  if (community.length > 0) {
    displayPluginGroup(`🌟 Community Plugins (${community.length})`, community);
  }
}

function displayPluginGroup(header: string, plugins: [string, any][]): void {
  logger.info(`${header}:`);
  logger.log('');
  for (const [name, info] of plugins) {
    logger.log(`  ✓ ${name} @ ${info.version}`);
    const platforms: string[] = [];
    if (info.platforms.android) platforms.push('Android');
    if (info.platforms.ios) platforms.push('iOS');
    logger.log(`    Platforms: ${platforms.join(', ')}`);
  }
  logger.log('');
}

function showAddPluginHint(): void {
  logger.log('');
  logger.info('To add plugins:');
  logger.info('  Official:   "@gyo-framework/camera": "^1.0.0"');
  logger.info('  Community:  "@gyo-community/analytics": "^1.0.0"');
  logger.log('');
  logger.info('Then run: gyo install');
}

async function cleanPluginCache(options: { all?: boolean }): Promise<void> {
  const spinner = ora('Cleaning plugin cache...').start();
  const cacheDir = path.join(process.cwd(), '.gyo', 'cache', 'plugins');

  try {
    if (!(await pathExists(cacheDir))) {
      spinner.info('Plugin cache is already empty');
      return;
    }

    if (options.all) {
      await fs.remove(cacheDir);
      spinner.succeed('All cached plugins removed');
      logger.log('');
      logger.info('Run: gyo install');
      return;
    }

    await cleanNpmPlugins(spinner, cacheDir);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail('Failed to clean plugin cache');
    throw new PluginError(message);
  }
}

async function cleanNpmPlugins(spinner: ora.Ora, cacheDir: string): Promise<void> {
  const manager = new PluginManager();
  const manifest = await manager.readManifest();

  if (!manifest) {
    spinner.warn('No plugin manifest found, removing all cache');
    await fs.remove(cacheDir);
    spinner.succeed('Cache directory removed');
    return;
  }

  let removedCount = 0;
  for (const [name, info] of Object.entries(manifest.plugins)) {
    if ((info as any).source === 'npm') {
      const pluginCachePath = path.join(cacheDir, name);
      if (await pathExists(pluginCachePath)) {
        await fs.remove(pluginCachePath);
        removedCount++;
        logger.verbose(`Removed cache for ${name}`);
      }
    }
  }

  spinner.succeed(`Removed ${removedCount} cached plugin(s)`);
  if (removedCount > 0) {
    logger.log('');
    logger.info('Run: gyo install');
  }
}

async function validatePlugins(): Promise<void> {
  const spinner = ora('Validating plugins...').start();

  try {
    const manager = new PluginManager();
    const plugins = await manager.discoverPlugins();

    if (plugins.length === 0) {
      spinner.info('No plugins to validate');
      return;
    }

    spinner.succeed(`Found ${plugins.length} plugin(s) to validate`);
    logger.log('');

    const { validCount, invalidCount } = await validateAllPlugins(manager, plugins);

    logger.log('');
    logger.log('Validation Summary:');
    logger.log(`  Valid: ${validCount}`);
    logger.log(`  Invalid: ${invalidCount}`);

    if (invalidCount > 0) {
      logger.log('');
      logger.warn('Some plugins have validation errors. Please fix them and run: gyo install');
      throw new PluginError('Validation failed');
    }

  } catch (error) {
    if (error instanceof GyoError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail('Plugin validation failed');
    throw new PluginError(message);
  }
}

async function validateAllPlugins(
  manager: PluginManager,
  plugins: any[]
): Promise<{ validCount: number; invalidCount: number }> {
  let validCount = 0;
  let invalidCount = 0;

  for (const plugin of plugins) {
    const issues: string[] = [];

    if (!plugin.name.startsWith('@gyo-framework/') && !plugin.name.startsWith('@gyo-community/')) {
      issues.push('Invalid scope: must be @gyo-framework/* or @gyo-community/*');
    }

    if (!plugin.platforms.android && !plugin.platforms.ios) {
      issues.push('No platform configurations found');
    }

    if (plugin.platforms.android) {
      const androidIssues = await validateAndroidPlatform(manager, plugin);
      issues.push(...androidIssues);
    }

    if (plugin.platforms.ios) {
      const iosIssues = await validateIOSPlatform(manager, plugin);
      issues.push(...iosIssues);
    }

    if (issues.length === 0) {
      logger.success(`✓ ${plugin.name}`);
      validCount++;
    } else {
      logger.error(`✗ ${plugin.name}`);
      for (const issue of issues) {
        logger.log(`    - ${issue}`);
      }
      invalidCount++;
    }
  }

  return { validCount, invalidCount };
}

async function validateAndroidPlatform(manager: PluginManager, plugin: any): Promise<string[]> {
  const issues: string[] = [];
  const androidPath = manager.getPluginPath(plugin, 'android');
  const buildGradlePath = path.join(androidPath, 'build.gradle');

  if (!(await pathExists(androidPath))) {
    issues.push(`Android directory not found: ${androidPath}`);
  } else if (!(await pathExists(buildGradlePath))) {
    issues.push('Android build.gradle not found');
  }

  return issues;
}

async function validateIOSPlatform(manager: PluginManager, plugin: any): Promise<string[]> {
  const issues: string[] = [];
  const iosPath = manager.getPluginPath(plugin, 'ios');
  const packageSwiftPath = path.join(iosPath, 'Package.swift');

  if (!(await pathExists(iosPath))) {
    issues.push(`iOS directory not found: ${iosPath}`);
  } else if (!(await pathExists(packageSwiftPath))) {
    issues.push('iOS Package.swift not found');
  }

  return issues;
}
