import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from './logger.js';
import { pathExists, readFile, writeFile, ensureDir } from './fs.js';

export interface PluginMetadata {
  name: string;
  version: string;
  source: 'npm' | 'local';
  platforms: {
    android?: {
      moduleName: string;
      sourceDir: string;
      localPath?: string;
    };
    ios?: {
      packageName: string;
      sourceDir: string;
      localPath?: string;
    };
  };
}

export interface PluginManifest {
  plugins: Record<string, {
    version: string;
    source: string;
    platforms: Record<string, any>;
  }>;
  generatedDate: string;
  gyoVersion: string;
}

export class PluginManager {
  private projectRoot: string;
  private gyoDir: string;
  private cacheDir: string;
  private manifestPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.gyoDir = path.join(projectRoot, '.gyo');
    this.cacheDir = path.join(this.gyoDir, 'cache', 'plugins');
    this.manifestPath = path.join(this.gyoDir, 'plugins.json');
  }

  private static readonly OFFICIAL_SCOPE = '@gyo-framework/';
  private static readonly COMMUNITY_SCOPE = '@gyo-community/';

  private isGyoPlugin(packageName: string): boolean {
    return packageName.startsWith(PluginManager.OFFICIAL_SCOPE) ||
           packageName.startsWith(PluginManager.COMMUNITY_SCOPE);
  }

  async discoverPlugins(): Promise<PluginMetadata[]> {
    const packageJsonPath = path.join(this.projectRoot, 'lib', 'package.json');
    
    if (!(await pathExists(packageJsonPath))) {
      logger.warn('lib/package.json not found');
      return [];
    }

    const packageJsonContent = await readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    const plugins: PluginMetadata[] = [];
    
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    const pluginNames = Object.keys(dependencies).filter(name => this.isGyoPlugin(name));

    for (const pluginName of pluginNames) {
      try {
        const pluginMetadata = await this.readPluginMetadata(pluginName);
        plugins.push(pluginMetadata);
      } catch (error) {
        logger.warn(`Failed to read metadata for plugin ${pluginName}: ${error}`);
      }
    }

    return plugins;
  }

  private toAndroidModuleName(packageName: string): string {
    const name = packageName.replace('@', '');
    if (name.startsWith('gyo-framework/')) {
      return 'gyo_framework_' + name.substring(14).replace(/[-]/g, '_');
    } else if (name.startsWith('gyo-community/')) {
      return 'gyo_community_' + name.substring(14).replace(/[-]/g, '_');
    }
    return name.replace(/[-]/g, '_');
  }

  private toIOSPackageName(packageName: string): string {
    const name = packageName.replace('@', '');
    
    if (name.startsWith('gyo-framework/')) {
      const pluginName = name.substring(14);
      const pascalName = pluginName
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      return 'GyoFramework' + pascalName;
    } else if (name.startsWith('gyo-community/')) {
      const pluginName = name.substring(14);
      const pascalName = pluginName
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      return 'GyoCommunity' + pascalName;
    }
    
    return name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  async readPluginMetadata(packageName: string): Promise<PluginMetadata> {
    const libNodeModules = path.join(this.projectRoot, 'lib', 'node_modules');
    const packageJsonPath = path.join(libNodeModules, packageName, 'package.json');

    if (!(await pathExists(packageJsonPath))) {
      throw new Error(`Plugin ${packageName} not found in node_modules. Run 'npm install' in lib/ directory first.`);
    }

    const packageJsonContent = await readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    const libPackageJsonPath = path.join(this.projectRoot, 'lib', 'package.json');
    const libPackageJsonContent = await readFile(libPackageJsonPath);
    const libPackageJson = JSON.parse(libPackageJsonContent);
    
    const dependency = libPackageJson.dependencies?.[packageName] || 
                       libPackageJson.devDependencies?.[packageName];
    const isLocal = dependency && dependency.startsWith('file:');

    const metadata: PluginMetadata = {
      name: packageName,
      version: packageJson.version,
      source: isLocal ? 'local' : 'npm',
      platforms: {},
    };

    const androidSourceDir = 'android';
    const androidPath = path.join(libNodeModules, packageName, androidSourceDir);
    
    if (await pathExists(androidPath)) {
      metadata.platforms.android = {
        moduleName: this.toAndroidModuleName(packageName),
        sourceDir: androidSourceDir,
      };

      if (isLocal) {
        metadata.platforms.android.localPath = androidPath;
      }
    }

    const iosSourceDir = 'ios';
    const iosPath = path.join(libNodeModules, packageName, iosSourceDir);
    
    if (await pathExists(iosPath)) {
      metadata.platforms.ios = {
        packageName: this.toIOSPackageName(packageName),
        sourceDir: iosSourceDir,
      };

      if (isLocal) {
        metadata.platforms.ios.localPath = iosPath;
      }
    }
    
    if (!metadata.platforms.android && !metadata.platforms.ios) {
      throw new Error(`Plugin ${packageName} has no android/ or ios/ directory`);
    }

    return metadata;
  }

  async cachePlugin(plugin: PluginMetadata): Promise<void> {
    if (plugin.source === 'local') {
      logger.verbose(`Skipping cache for local plugin ${plugin.name}`);
      return;
    }

    const sourcePath = path.join(this.projectRoot, 'lib', 'node_modules', plugin.name);
    const destPath = path.join(this.cacheDir, plugin.name);

    // Ensure cache directory exists
    await ensureDir(destPath);

    // Copy Android platform
    if (plugin.platforms.android) {
      const androidSource = path.join(sourcePath, plugin.platforms.android.sourceDir);
      const androidDest = path.join(destPath, plugin.platforms.android.sourceDir);
      
      if (await pathExists(androidSource)) {
        await fs.copy(androidSource, androidDest, { overwrite: true });
        logger.verbose(`  Cached Android code for ${plugin.name}`);
      }
    }

    // Copy iOS platform
    if (plugin.platforms.ios) {
      const iosSource = path.join(sourcePath, plugin.platforms.ios.sourceDir);
      const iosDest = path.join(destPath, plugin.platforms.ios.sourceDir);
      
      if (await pathExists(iosSource)) {
        await fs.copy(iosSource, iosDest, { overwrite: true });
        logger.verbose(`  Cached iOS code for ${plugin.name}`);
      }
    }
  }

  async updateManifest(plugins: PluginMetadata[]): Promise<void> {
    await ensureDir(this.gyoDir);

    const manifest: PluginManifest = {
      plugins: {},
      generatedDate: new Date().toISOString(),
      gyoVersion: '0.1.0',
    };

    for (const plugin of plugins) {
      const platformsInfo: Record<string, any> = {};

      if (plugin.platforms.android) {
        const androidPath = plugin.source === 'local' && plugin.platforms.android.localPath
          ? plugin.platforms.android.localPath
          : path.join('.gyo', 'cache', 'plugins', plugin.name, plugin.platforms.android.sourceDir);

        platformsInfo.android = {
          path: androidPath,
          moduleName: plugin.platforms.android.moduleName,
        };
      }

      if (plugin.platforms.ios) {
        const iosPath = plugin.source === 'local' && plugin.platforms.ios.localPath
          ? plugin.platforms.ios.localPath
          : path.join('.gyo', 'cache', 'plugins', plugin.name, plugin.platforms.ios.sourceDir);

        platformsInfo.ios = {
          path: iosPath,
          packageName: plugin.platforms.ios.packageName,
        };
      }

      manifest.plugins[plugin.name] = {
        version: plugin.version,
        source: plugin.source,
        platforms: platformsInfo,
      };
    }

    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
    logger.verbose('Updated .gyo/plugins.json manifest');
  }

  async readManifest(): Promise<PluginManifest | null> {
    if (!(await pathExists(this.manifestPath))) {
      return null;
    }

    const content = await readFile(this.manifestPath);
    return JSON.parse(content);
  }

  getPluginPath(plugin: PluginMetadata, platform: 'android' | 'ios'): string {
    if (plugin.source === 'local' && plugin.platforms[platform]?.localPath) {
      return plugin.platforms[platform]!.localPath!;
    }

    const sourceDir = plugin.platforms[platform]?.sourceDir || platform;
    return path.join(this.cacheDir, plugin.name, sourceDir);
  }

  getRelativePluginPath(plugin: PluginMetadata, platform: 'android' | 'ios'): string {
    const pluginPath = this.getPluginPath(plugin, platform);
    const platformDir = path.join(this.projectRoot, platform);
    const relativePath = path.relative(platformDir, pluginPath);
    
    // Convert to forward slashes for cross-platform compatibility
    return relativePath.replace(/\\/g, '/');
  }
}
