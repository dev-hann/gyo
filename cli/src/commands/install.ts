import { Command } from 'commander';
import * as path from 'path';
import ora from 'ora';
import { logger } from '../utils/logger.js';
import { PluginManager } from '../utils/plugin-manager.js';
import { AndroidPluginIntegrator } from '../utils/android-plugin-integrator.js';
import { IosPluginIntegrator } from '../utils/ios-plugin-integrator.js';
import { executeCommand } from '../utils/exec.js';
import { pathExists } from '../utils/fs.js';
import { validateGyoProject, suggestNextSteps } from '../utils/command-utils.js';
import { GyoError, PluginError, NpmInstallError } from '../utils/errors.js';

export function registerInstallCommand(program: Command): void {
  program
    .command('install')
    .description('Install npm dependencies and configure plugins')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--skip-npm', 'Skip npm install step')
    .action(async (options: { verbose?: boolean; skipNpm?: boolean }) => {
      if (options.verbose) {
        logger.setVerbose(true);
      }
      await installPlugins(options);
    });
}

async function installPlugins(options: { skipNpm?: boolean }): Promise<void> {
  const spinner = ora('Starting installation...').start();
  const projectRoot = process.cwd();
  const libPath = path.join(projectRoot, 'lib');

  try {
    await validateGyoProject(projectRoot);

    if (!options.skipNpm) {
      await runNpmInstall(spinner, libPath);
    } else {
      logger.verbose('Skipping npm install (--skip-npm flag)');
    }

    const manager = new PluginManager();
    
    spinner.start('Discovering plugins...');
    const plugins = await manager.discoverPlugins();

    if (plugins.length === 0) {
      spinner.info('No plugins found in package.json');
      showNoPluginsMessage();
      return;
    }

    spinner.succeed(`Found ${plugins.length} plugin(s): ${plugins.map(p => p.name).join(', ')}`);

    await cachePlugins(spinner, manager, plugins);

    spinner.start('Updating plugin manifest...');
    await manager.updateManifest(plugins);
    spinner.succeed('Updated .gyo/plugins.json');

    await integratePlatforms(spinner, plugins);

    showSuccessMessage(plugins);

  } catch (error) {
    if (error instanceof GyoError) {
      spinner.fail(error.message);
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail('Plugin installation failed');
    throw new PluginError(message);
  }
}

async function runNpmInstall(spinner: ora.Ora, libPath: string): Promise<void> {
  spinner.text = 'Running npm install in lib/...';
  
  const result = await executeCommand('npm', ['install'], {
    cwd: libPath,
    stdio: logger.isVerbose() ? 'inherit' : 'pipe',
  });

  if (!result.success) {
    throw new NpmInstallError('dependencies', result.stderr || result.stdout);
  }

  spinner.succeed('npm dependencies installed');
}

async function cachePlugins(
  spinner: ora.Ora,
  manager: PluginManager,
  plugins: any[]
): Promise<void> {
  logger.info('📦 Caching plugin native code...');
  
  for (const plugin of plugins) {
    const pluginSpinner = ora(`Caching ${plugin.name}`).start();
    try {
      await manager.cachePlugin(plugin);

      const platforms: string[] = [];
      if (plugin.platforms.android) platforms.push('Android');
      if (plugin.platforms.ios) platforms.push('iOS');

      pluginSpinner.succeed(`Cached ${plugin.name} (${platforms.join(', ')})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pluginSpinner.fail(`Failed to cache ${plugin.name}: ${message}`);
    }
  }
}

async function integratePlatforms(spinner: ora.Ora, plugins: any[]): Promise<void> {
  const androidPlugins = plugins.filter(p => p.platforms.android);
  const iosPlugins = plugins.filter(p => p.platforms.ios);

  if (androidPlugins.length > 0) {
    spinner.start('Updating Android configuration...');
    try {
      const integrator = new AndroidPluginIntegrator();
      await integrator.updateSettingsGradle(androidPlugins);
      await integrator.updateAppBuildGradle(androidPlugins);
      spinner.succeed(`Updated Android configuration (${androidPlugins.length} plugin(s))`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to update Android configuration: ${message}`);
    }
  }

  if (iosPlugins.length > 0) {
    spinner.start('Updating iOS configuration...');
    try {
      const integrator = new IosPluginIntegrator();
      await integrator.updatePackageSwift(iosPlugins);
      spinner.succeed(`Updated iOS configuration (${iosPlugins.length} plugin(s))`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to update iOS configuration: ${message}`);
    }
  }
}

function showNoPluginsMessage(): void {
  logger.log('');
  logger.info('To add plugins:');
  logger.info('  1. Add scoped packages to lib/package.json:');
  logger.log('');
  logger.info('     Official:   "@gyo-framework/camera": "^1.0.0"');
  logger.info('     Community:  "@gyo-community/analytics": "^1.0.0"');
  logger.log('');
  logger.info('  2. Run: gyo install');
  logger.log('');
}

function showSuccessMessage(plugins: any[]): void {
  const androidPlugins = plugins.filter(p => p.platforms.android);
  const iosPlugins = plugins.filter(p => p.platforms.ios);

  logger.log('');
  logger.success('✨ Plugin installation complete!');

  const nextSteps: string[] = [];
  if (androidPlugins.length > 0) nextSteps.push('Build Android: gyo build android');
  if (iosPlugins.length > 0) nextSteps.push('Build iOS: gyo build ios');

  suggestNextSteps(nextSteps);
}
