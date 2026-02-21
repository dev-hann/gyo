import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from './logger.js';
import { pathExists, readFile } from './fs.js';

/**
 * Check if plugins need to be synced by comparing package.json and plugins.json
 */
export async function needsPluginSync(projectRoot: string = process.cwd()): Promise<boolean> {
  try {
    const packageJsonPath = path.join(projectRoot, 'lib', 'package.json');
    const pluginsJsonPath = path.join(projectRoot, '.gyo', 'plugins.json');

    // If plugins.json doesn't exist, sync is needed
    if (!(await pathExists(pluginsJsonPath))) {
      logger.verbose('plugins.json not found, sync needed');
      return true;
    }

    // If package.json doesn't exist, no sync needed (no plugins)
    if (!(await pathExists(packageJsonPath))) {
      logger.verbose('package.json not found, no sync needed');
      return false;
    }

    // Read both files
    const packageJsonContent = await readFile(packageJsonPath);
    const pluginsJsonContent = await readFile(pluginsJsonPath);

    const packageJson = JSON.parse(packageJsonContent);
    const pluginsJson = JSON.parse(pluginsJsonContent);

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    const declaredPlugins = Object.keys(dependencies).filter(name =>
      name.startsWith('@gyo-framework/') || name.startsWith('@gyo-community/')
    );

    const installedPlugins = Object.keys(pluginsJson.plugins || {});

    // Check if plugin lists match
    if (declaredPlugins.length !== installedPlugins.length) {
      logger.verbose(`Plugin count mismatch: declared=${declaredPlugins.length}, installed=${installedPlugins.length}`);
      return true;
    }

    // Check if all declared plugins are installed
    for (const plugin of declaredPlugins) {
      if (!installedPlugins.includes(plugin)) {
        logger.verbose(`Plugin ${plugin} is declared but not installed`);
        return true;
      }
    }

    // Check package.json modification time vs plugins.json
    const packageStats = await fs.stat(packageJsonPath);
    const pluginsStats = await fs.stat(pluginsJsonPath);

    if (packageStats.mtime > pluginsStats.mtime) {
      logger.verbose('package.json is newer than plugins.json, sync needed');
      return true;
    }

    logger.verbose('Plugins are in sync');
    return false;
  } catch (error) {
    logger.verbose(`Error checking plugin sync status: ${error}`);
    // If there's an error, it's safer to sync
    return true;
  }
}

/**
 * Auto-sync plugins before build if needed
 */
export async function autoSyncPlugins(projectRoot: string = process.cwd()): Promise<void> {
  if (await needsPluginSync(projectRoot)) {
    logger.info('📦 Plugins out of sync, running gyo install...');
    
    // Import install function dynamically to avoid circular dependency
    const { PluginManager } = await import('./plugin-manager.js');
    const { AndroidPluginIntegrator } = await import('./android-plugin-integrator.js');
    const { IosPluginIntegrator } = await import('./ios-plugin-integrator.js');

    const pluginManager = new PluginManager(projectRoot);
    const plugins = await pluginManager.discoverPlugins();

    if (plugins.length === 0) {
      logger.verbose('No plugins to sync');
      return;
    }

    // Cache plugins
    for (const plugin of plugins) {
      await pluginManager.cachePlugin(plugin);
    }

    // Update manifest
    await pluginManager.updateManifest(plugins);

    // Integrate with Android
    const androidPlugins = plugins.filter(p => p.platforms.android);
    if (androidPlugins.length > 0) {
      const androidIntegrator = new AndroidPluginIntegrator(projectRoot);
      await androidIntegrator.updateSettingsGradle(androidPlugins);
      await androidIntegrator.updateAppBuildGradle(androidPlugins);
    }

    // Integrate with iOS
    const iosPlugins = plugins.filter(p => p.platforms.ios);
    if (iosPlugins.length > 0) {
      const iosIntegrator = new IosPluginIntegrator(projectRoot);
      await iosIntegrator.updatePackageSwift(iosPlugins);
    }

    logger.success('✓ Plugins synced automatically');
  }
}
