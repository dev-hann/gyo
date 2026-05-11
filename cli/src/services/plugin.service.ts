import * as path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger';
import { pathExists, readJson, writeFile, ensureDir } from '../utils/fs';

export interface GyoPluginAndroid {
  handlerClass: string;
}

export interface GyoPluginMeta {
  bridgeName: string;
  android?: GyoPluginAndroid;
  ios?: Record<string, string>;
}

export interface DiscoveredPlugin {
  name: string;
  version: string;
  path: string;
  meta: GyoPluginMeta;
  hasAndroid: boolean;
  hasIOS: boolean;
}

export interface PluginManifest {
  plugins: DiscoveredPlugin[];
  timestamp: string;
}

const GYO_PLUGIN_SCOPES = ['@gyo-framework', '@gyo-community'];
const MANIFEST_FILE = '.gyo-plugins';
const PLUGIN_REGISTRY_PACKAGE = 'gyo.plugins.bridge';
const PLUGIN_REGISTRY_CLASS = 'PluginRegistry';

function getLibPath(projectPath: string): string {
  return path.join(projectPath, 'lib');
}

function getAndroidPluginPath(androidPath: string): string {
  return path.join(androidPath, 'app/src/main/java/gyo/plugins');
}

export async function discoverPlugins(projectPath: string): Promise<DiscoveredPlugin[]> {
  const libPath = getLibPath(projectPath);
  const nodeModulesPath = path.join(libPath, 'node_modules');

  if (!(await pathExists(nodeModulesPath))) {
    logger.debug('node_modules not found in lib/');
    return [];
  }

  const plugins: DiscoveredPlugin[] = [];

  for (const scope of GYO_PLUGIN_SCOPES) {
    const scopePath = path.join(nodeModulesPath, scope);
    if (!(await pathExists(scopePath))) continue;

    const entries = await fs.readdir(scopePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(scopePath, entry.name);
      const pkgJsonPath = path.join(pluginDir, 'package.json');

      if (!(await pathExists(pkgJsonPath))) continue;

      try {
        const pkgJson = (await readJson(pkgJsonPath)) as {
          name: string;
          version: string;
          gyo?: GyoPluginMeta;
        };

        if (!pkgJson.gyo) {
          logger.debug(`Skipping ${pkgJson.name}: no "gyo" field in package.json`);
          continue;
        }

        const hasAndroid = await pathExists(path.join(pluginDir, 'android/src'));
        const hasIOS = await pathExists(path.join(pluginDir, 'ios/Sources'));

        plugins.push({
          name: pkgJson.name,
          version: pkgJson.version,
          path: pluginDir,
          meta: pkgJson.gyo,
          hasAndroid,
          hasIOS,
        });
      } catch (e) {
        logger.debug(`Failed to read ${pkgJsonPath}: ${e}`);
      }
    }
  }

  return plugins;
}

export async function syncAndroidPlugins(
  androidPath: string,
  plugins: DiscoveredPlugin[]
): Promise<void> {
  const pluginJavaPath = getAndroidPluginPath(androidPath);

  const androidPlugins = plugins.filter((p) => p.hasAndroid && p.meta.android);
  if (androidPlugins.length === 0) {
    logger.debug('No Android plugins to sync');
    return;
  }

  for (const plugin of androidPlugins) {
    const androidMeta = plugin.meta.android;
    if (!androidMeta) continue;
    const handlerClass = androidMeta.handlerClass;
    const classParts = handlerClass.split('.');
    const className = classParts[classParts.length - 1];
    const packageParts = classParts.slice(0, -1);
    const destDir = path.join(pluginJavaPath, ...packageParts.slice(2));

    await ensureDir(destDir);

    const srcDir = path.join(plugin.path, 'android/src/main/kotlin', ...packageParts.slice(2));
    if (await pathExists(srcDir)) {
      const files = await fs.readdir(srcDir);
      for (const file of files) {
        if (file.endsWith('.kt')) {
          await fs.copy(path.join(srcDir, file), path.join(destDir, file), {
            overwrite: true,
          });
          logger.debug(`Copied ${file} -> ${destDir}`);
        }
      }
    } else {
      const altSrcDir = path.join(plugin.path, 'android/src/main/java', ...packageParts.slice(2));
      if (await pathExists(altSrcDir)) {
        const files = await fs.readdir(altSrcDir);
        for (const file of files) {
          if (file.endsWith('.kt') || file.endsWith('.java')) {
            await fs.copy(path.join(altSrcDir, file), path.join(destDir, file), {
              overwrite: true,
            });
            logger.debug(`Copied ${file} -> ${destDir}`);
          }
        }
      } else {
        logger.warn(`No source found for ${plugin.name} at expected paths`);
      }
    }

    logger.verbose(`Synced ${plugin.name} -> ${className}`);
  }
}

export async function generatePluginRegistry(
  androidPath: string,
  plugins: DiscoveredPlugin[]
): Promise<void> {
  const bridgePath = path.join(androidPath, 'app/src/main/java/gyo/plugins/bridge');
  await ensureDir(bridgePath);

  const androidPlugins = plugins.filter((p) => p.hasAndroid && p.meta.android);

  const imports = new Set<string>();
  const registrations: string[] = [];

  imports.add('import android.content.Context');
  imports.add(`import ${PLUGIN_REGISTRY_PACKAGE}.BridgeRegistry`);

  for (const plugin of androidPlugins) {
    const androidMeta = plugin.meta.android;
    if (!androidMeta) continue;
    const handlerClass = androidMeta.handlerClass;
    const bridgeName = plugin.meta.bridgeName;
    imports.add(`import ${handlerClass}`);
    registrations.push(
      `        BridgeRegistry.register("${bridgeName}", ${handlerClass.split('.').pop()}(context))`
    );
  }

  const content = [
    `package ${PLUGIN_REGISTRY_PACKAGE}`,
    '',
    ...Array.from(imports).sort(),
    '',
    `object ${PLUGIN_REGISTRY_CLASS} {`,
    `    fun registerAll(context: Context) {`,
    ...registrations,
    `    }`,
    '}',
    '',
  ].join('\n');

  const registryPath = path.join(bridgePath, `${PLUGIN_REGISTRY_CLASS}.kt`);
  await writeFile(registryPath, content);
  logger.verbose(`Generated ${PLUGIN_REGISTRY_CLASS}.kt with ${androidPlugins.length} plugin(s)`);
}

export async function updateMainActivity(
  androidPath: string,
  packageName: string,
  plugins: DiscoveredPlugin[]
): Promise<void> {
  const packagePath = packageName.replace(/\./g, '/');
  const mainActivityDir = path.join(androidPath, `app/src/main/java/${packagePath}`);
  const mainActivityPath = path.join(mainActivityDir, 'MainActivity.kt');

  if (!(await pathExists(mainActivityPath))) {
    logger.warn('MainActivity.kt not found');
    return;
  }

  let content = await fs.readFile(mainActivityPath, 'utf-8');

  const hasPluginRegistryImport = content.includes(
    `import ${PLUGIN_REGISTRY_PACKAGE}.${PLUGIN_REGISTRY_CLASS}`
  );
  if (!hasPluginRegistryImport && plugins.length > 0) {
    content = content.replace(
      'import gyo.plugins.bridge.BridgeRegistry',
      `import gyo.plugins.bridge.BridgeRegistry\nimport ${PLUGIN_REGISTRY_PACKAGE}.${PLUGIN_REGISTRY_CLASS}`
    );
  }

  const registryCall = `${PLUGIN_REGISTRY_CLASS}.registerAll(this)`;
  if (!content.includes(registryCall) && plugins.length > 0) {
    content = content.replace(
      /\/\/\s*Example:\s*Register custom bridges here[\s\S]*?BridgeRegistry\.register\("my-custom-bridge".*?\)/,
      registryCall
    );

    if (!content.includes(registryCall)) {
      content = content.replace(
        'BridgeRegistry.initialize()',
        `BridgeRegistry.initialize()\n        \n        ${registryCall}`
      );
    }
  }

  if (plugins.length === 0) {
    content = content.replace(`\n        \n        ${registryCall}`, '');
    content = content.replace(`\n        ${registryCall}`, '');
    content = content.replace(`import ${PLUGIN_REGISTRY_PACKAGE}.${PLUGIN_REGISTRY_CLASS}\n`, '');
  }

  await writeFile(mainActivityPath, content);
  logger.verbose('Updated MainActivity.kt');
}

export async function writeManifest(
  projectPath: string,
  plugins: DiscoveredPlugin[]
): Promise<void> {
  const manifest: PluginManifest = {
    plugins,
    timestamp: new Date().toISOString(),
  };
  const manifestPath = path.join(projectPath, MANIFEST_FILE);
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  logger.verbose(`Wrote ${MANIFEST_FILE}`);
}

export async function readManifest(projectPath: string): Promise<PluginManifest | null> {
  const manifestPath = path.join(projectPath, MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    return null;
  }
  try {
    return (await readJson(manifestPath)) as PluginManifest;
  } catch {
    return null;
  }
}

export function needsSync(
  manifest: PluginManifest | null,
  currentPlugins: DiscoveredPlugin[]
): boolean {
  if (!manifest) return true;

  if (manifest.plugins.length !== currentPlugins.length) return true;

  for (const current of currentPlugins) {
    const saved = manifest.plugins.find((p) => p.name === current.name);
    if (!saved) return true;
    if (saved.version !== current.version) return true;
    if (saved.hasAndroid !== current.hasAndroid) return true;
    if (saved.hasIOS !== current.hasIOS) return true;
  }

  return false;
}
