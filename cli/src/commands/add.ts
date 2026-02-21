import { Command } from 'commander';
import * as path from 'path';
import ora from 'ora';
import { logger } from '../utils/logger.js';
import { PluginManager, PluginMetadata } from '../utils/plugin-manager.js';
import { AndroidPluginIntegrator } from '../utils/android-plugin-integrator.js';
import { IosPluginIntegrator } from '../utils/ios-plugin-integrator.js';
import { executeCommand } from '../utils/exec.js';
import { pathExists } from '../utils/fs.js';
import { validateGyoProject, suggestNextSteps } from '../utils/command-utils.js';
import { GyoError, NpmInstallError, PluginError } from '../utils/errors.js';

export function registerAddCommand(program: Command): void {
  program
    .command('add <package-name>')
    .description('Add a Gyo plugin (e.g., @gyo-framework/camera)')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dev', 'Install as dev dependency')
    .option('--skip-npm', 'Skip npm install step')
    .action(async (packageName: string, options: { verbose?: boolean; dev?: boolean; skipNpm?: boolean }) => {
      if (options.verbose) {
        logger.setVerbose(true);
      }
      await addPlugin(packageName, options);
    });
}

async function addPlugin(
  packageName: string,
  options: { dev?: boolean; skipNpm?: boolean }
): Promise<void> {
  const spinner = ora(`Adding plugin: ${packageName}`).start();
  const projectRoot = process.cwd();
  const libPath = path.join(projectRoot, 'lib');

  try {
    await validateGyoProject(projectRoot);

    if (!options.skipNpm) {
      spinner.text = `Installing ${packageName} via npm...`;
      await installNpmPackage(libPath, packageName, options.dev);
      spinner.succeed(`Installed ${packageName}`);
    } else {
      logger.verbose('Skipping npm install (--skip-npm flag)');
    }

    spinner.start('Discovering plugin...');
    const { plugin, manager } = await discoverPlugin(packageName);
    spinner.succeed(`Discovered plugin: ${plugin.name} @ ${plugin.version}`);

    await cachePlugin(spinner, manager, plugin);

    spinner.start('Updating plugin manifest...');
    await manager.updateManifest([plugin]);
    spinner.succeed('Updated .gyo/plugins.json');

    await integratePlatforms(spinner, plugin);

    showSuccessMessage(packageName, plugin);

  } catch (error) {
    if (error instanceof GyoError) {
      spinner.fail(error.message);
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(`Failed to add plugin ${packageName}`);
    throw new PluginError(message);
  }
}

async function installNpmPackage(
  libPath: string,
  packageName: string,
  isDev?: boolean
): Promise<void> {
  const npmArgs = ['install', packageName, isDev ? '--save-dev' : '--save'];

  const result = await executeCommand('npm', npmArgs, {
    cwd: libPath,
    stdio: logger.isVerbose() ? 'inherit' : 'pipe',
  });

  if (!result.success) {
    throw new NpmInstallError(packageName, result.stderr || result.stdout);
  }
}

async function discoverPlugin(packageName: string): Promise<{
  plugin: PluginMetadata;
  manager: PluginManager;
}> {
  const manager = new PluginManager();
  const plugins = await manager.discoverPlugins();

  const normalizedName = packageName.replace('@', '').replace('/', '-');
  const plugin = plugins.find(p => p.name === packageName || p.name === normalizedName);

  if (!plugin) {
    logger.warn(`Plugin ${packageName} was installed but not found in discovery`);
    logger.log('');
    logger.info('Make sure the package is a Gyo plugin:');
    logger.info('  • Package name starts with @gyo-framework/ or @gyo-community/');
    logger.info('  • Has android/ directory with build.gradle (for Android support)');
    logger.info('  • Has ios/ directory with Package.swift (for iOS support)');
    throw new PluginError(`Plugin ${packageName} not discovered`);
  }

  return { plugin, manager };
}

async function cachePlugin(
  spinner: ora.Ora,
  manager: PluginManager,
  plugin: PluginMetadata
): Promise<void> {
  spinner.start('Caching plugin native code...');
  
  try {
    await manager.cachePlugin(plugin);

    const platforms: string[] = [];
    if (plugin.platforms.android) platforms.push('Android');
    if (plugin.platforms.ios) platforms.push('iOS');

    spinner.succeed(`Cached ${plugin.name} (${platforms.join(', ')})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(`Failed to cache ${plugin.name}: ${message}`);
    throw error;
  }
}

async function integratePlatforms(
  spinner: ora.Ora,
  plugin: PluginMetadata
): Promise<void> {
  if (plugin.platforms.android) {
    spinner.start('Updating Android configuration...');
    try {
      const integrator = new AndroidPluginIntegrator();
      await integrator.updateSettingsGradle([plugin]);
      await integrator.updateAppBuildGradle([plugin]);
      spinner.succeed('Updated Android configuration');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to update Android configuration: ${message}`);
      throw error;
    }
  }

  if (plugin.platforms.ios) {
    spinner.start('Updating iOS configuration...');
    try {
      const integrator = new IosPluginIntegrator();
      await integrator.updatePackageSwift([plugin]);
      spinner.succeed('Updated iOS configuration');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to update iOS configuration: ${message}`);
      throw error;
    }
  }
}

function showSuccessMessage(
  packageName: string,
  plugin: PluginMetadata
): void {
  logger.log('');
  logger.success(`✨ Plugin ${packageName} added successfully!`);

  const nextSteps = [`Use the plugin: import { ... } from '${packageName}'`];
  if (plugin.platforms.android) nextSteps.push('Build Android: gyo build android');
  if (plugin.platforms.ios) nextSteps.push('Build iOS: gyo build ios');
  nextSteps.push('See all plugins: gyo plugin list');

  suggestNextSteps(nextSteps);
}
