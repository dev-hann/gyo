import * as path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger';
import { pathExists, readJson } from '../utils/fs';
import { GyoError } from '../core/errors';

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

/** What the last sync put into the platform projects. Paths are relative to the project. */
export interface PluginManifest {
  plugins: DiscoveredPlugin[];
}

/** A plugin with an Android handler whose declaration could be read. */
interface AndroidPlugin {
  plugin: DiscoveredPlugin;
  handlerClass: string;
  /** Package segments of `handlerClass`. */
  segments: string[];
}

const GYO_PLUGIN_SCOPES = ['@gyo-framework', '@gyo-community'];
const MANIFEST_FILE = '.gyo-plugins';
const PLUGIN_REGISTRY_PACKAGE = 'gyo.plugins.bridge';
const PLUGIN_REGISTRY_CLASS = 'PluginRegistry';
const JAVA_SOURCE_ROOT = 'app/src/main/java';
/** Where a plugin keeps the sources of its handler's package, in order of preference. */
const PLUGIN_SOURCE_ROOTS = ['android/src/main/kotlin', 'android/src/main/java'];
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `text` as a regular expression that matches exactly `text`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function discoverPlugins(projectPath: string): Promise<DiscoveredPlugin[]> {
  const nodeModulesPath = path.join(projectPath, 'lib', 'node_modules');

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

        plugins.push({
          name: pkgJson.name,
          version: pkgJson.version,
          path: pluginDir,
          meta: pkgJson.gyo,
          hasAndroid: await pathExists(path.join(pluginDir, 'android/src')),
          hasIOS: await pathExists(path.join(pluginDir, 'ios/Sources')),
        });
      } catch (e) {
        logger.debug(`Failed to read ${pkgJsonPath}: ${e}`);
      }
    }
  }

  return plugins;
}

/**
 * Reads the Android handler a plugin declares. A declared handler that
 * cannot be read fails: syncing around it would leave the build broken.
 */
function toAndroidPlugin(plugin: DiscoveredPlugin): AndroidPlugin | null {
  const handlerClass = plugin.meta.android?.handlerClass;
  if (!plugin.hasAndroid || handlerClass === undefined) {
    return null;
  }

  const segments = typeof handlerClass === 'string' ? handlerClass.split('.') : [];
  const isClassName = segments.length >= 2 && segments.every((s) => IDENTIFIER.test(s));
  if (!isClassName) {
    throw new GyoError(
      `${plugin.name} declares "${String(handlerClass)}" as its Android handler, which is not a class name.`
    );
  }
  const { bridgeName } = plugin.meta;
  if (typeof bridgeName !== 'string' || !IDENTIFIER.test(bridgeName)) {
    throw new GyoError(`${plugin.name} declares "${String(bridgeName)}" as its bridge name.`);
  }

  return { plugin, handlerClass, segments: segments.slice(0, -1) };
}

function androidPlugins(plugins: DiscoveredPlugin[]): AndroidPlugin[] {
  return plugins.flatMap((plugin) => {
    const android = toAndroidPlugin(plugin);
    return android ? [android] : [];
  });
}

/** Where the sources of a handler's package live in the Android project. */
function handlerDir(androidPath: string, { segments }: AndroidPlugin): string {
  return path.join(androidPath, JAVA_SOURCE_ROOT, ...segments);
}

async function copySources(androidPath: string, android: AndroidPlugin): Promise<void> {
  const { plugin, segments } = android;
  const sourceDirs = PLUGIN_SOURCE_ROOTS.map((root) => path.join(plugin.path, root, ...segments));

  for (const srcDir of sourceDirs) {
    if (await pathExists(srcDir)) {
      await fs.copy(srcDir, handlerDir(androidPath, android));
      logger.verbose(`Copied ${path.relative(plugin.path, srcDir)} of ${plugin.name}`);
      return;
    }
  }

  throw new GyoError(
    `${plugin.name} declares the handler ${android.handlerClass} but ships no sources for its ` +
      `package. Expected one of: ${sourceDirs
        .map((dir) => path.relative(plugin.path, dir))
        .join(', ')}`
  );
}

async function removeGoneSources(
  androidPath: string,
  previous: DiscoveredPlugin[],
  current: AndroidPlugin[]
): Promise<void> {
  const kept = new Set(current.map((android) => handlerDir(androidPath, android)));

  for (const android of androidPlugins(previous)) {
    const dir = handlerDir(androidPath, android);
    if (kept.has(dir) || !(await pathExists(dir))) continue;

    await fs.remove(dir);
    logger.verbose(`Removed the sources of ${android.plugin.name}`);
  }
}

function registryPath(androidPath: string): string {
  return path.join(
    androidPath,
    JAVA_SOURCE_ROOT,
    ...PLUGIN_REGISTRY_PACKAGE.split('.'),
    `${PLUGIN_REGISTRY_CLASS}.kt`
  );
}

/** Writes the registry that registers every Android handler, or removes it when there is none. */
async function writePluginRegistry(androidPath: string, plugins: AndroidPlugin[]): Promise<void> {
  const registry = registryPath(androidPath);

  if (plugins.length === 0) {
    await fs.remove(registry);
    return;
  }

  const imports = new Set<string>([
    'import android.content.Context',
    `import ${PLUGIN_REGISTRY_PACKAGE}.BridgeRegistry`,
  ]);
  const registrations = plugins.map(({ plugin, handlerClass }) => {
    imports.add(`import ${handlerClass}`);
    const className = handlerClass.split('.').pop();
    return `        BridgeRegistry.register("${plugin.meta.bridgeName}", ${className}(context))`;
  });

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

  await fs.outputFile(registry, content);
}

async function findFile(dir: string, fileName: string): Promise<string | null> {
  if (!(await pathExists(dir))) {
    return null;
  }
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFile(entryPath, fileName);
      if (found) {
        return found;
      }
    } else if (entry.name === fileName) {
      return entryPath;
    }
  }
  return null;
}

/**
 * `MainActivity.kt`, wherever the generated project keeps it. It is found
 * by name: the package in gyo.config.json is not what places the file.
 */
async function findMainActivity(androidPath: string): Promise<string | null> {
  for (const root of ['app/src/main/java', 'app/src/main/kotlin']) {
    const found = await findFile(path.join(androidPath, root), 'MainActivity.kt');
    if (found) {
      return found;
    }
  }
  return null;
}

/** Adds or removes the line that registers the plugins from MainActivity. */
async function wireMainActivity(androidPath: string, plugins: AndroidPlugin[]): Promise<void> {
  const mainActivityPath = await findMainActivity(androidPath);
  if (!mainActivityPath) {
    if (plugins.length === 0) {
      return;
    }
    throw new GyoError(
      `MainActivity.kt not found under ${path.join(androidPath, JAVA_SOURCE_ROOT)}, so the plugins cannot be registered.`
    );
  }

  const original = await fs.readFile(mainActivityPath, 'utf-8');
  let content = original;
  const registryImport = `import ${PLUGIN_REGISTRY_PACKAGE}.${PLUGIN_REGISTRY_CLASS}`;
  const registryCall = `${PLUGIN_REGISTRY_CLASS}.registerAll(this)`;

  if (plugins.length === 0) {
    content = content
      .replace(new RegExp(`^${escapeRegExp(registryImport)}\\r?\\n`, 'm'), '')
      .replace(new RegExp(`^[ \\t]*${escapeRegExp(registryCall)}\\r?\\n`, 'm'), '');
  } else {
    if (!content.includes(registryCall)) {
      const initialize = /^([ \t]*)BridgeRegistry\.initialize\(\)/m;
      if (!initialize.test(content)) {
        throw new GyoError(
          `${mainActivityPath} has no "BridgeRegistry.initialize()" line to register the plugins after.`
        );
      }
      content = content.replace(initialize, `$1BridgeRegistry.initialize()\n$1${registryCall}`);
    }
    if (!content.includes(registryImport)) {
      const bridgeImport = 'import gyo.plugins.bridge.BridgeRegistry';
      content = content.includes(bridgeImport)
        ? content.replace(bridgeImport, `${bridgeImport}\n${registryImport}`)
        : content.replace(/^(package [^\n]+)\n/, `$1\n\n${registryImport}\n`);
    }
  }

  if (content !== original) {
    await fs.writeFile(mainActivityPath, content, 'utf-8');
  }
}

export async function readManifest(projectPath: string): Promise<PluginManifest | null> {
  const manifestPath = path.join(projectPath, MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    return null;
  }
  try {
    const manifest = (await readJson(manifestPath)) as PluginManifest;
    return { plugins: Array.isArray(manifest.plugins) ? manifest.plugins : [] };
  } catch {
    return null;
  }
}

export async function writeManifest(
  projectPath: string,
  plugins: DiscoveredPlugin[]
): Promise<void> {
  const manifest: PluginManifest = {
    plugins: plugins.map((plugin) => ({
      ...plugin,
      path: path.relative(projectPath, plugin.path),
    })),
  };
  await fs.writeJson(path.join(projectPath, MANIFEST_FILE), manifest, { spaces: 2 });
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

/**
 * Makes the Android project match the plugins installed in lib/: the
 * sources of their handlers, the registry that registers them and the line
 * in MainActivity that runs it. The sources of plugins that are gone are
 * removed. A plugin that cannot be synced fails the sync: going on would
 * only move the failure into the Gradle build.
 */
export async function syncAndroidPlugins(
  projectPath: string,
  plugins?: DiscoveredPlugin[]
): Promise<void> {
  const current = plugins ?? (await discoverPlugins(projectPath));
  const androidPath = path.join(projectPath, 'android');
  if (!(await pathExists(androidPath))) {
    throw new GyoError(`Android project not found at ${androidPath}`);
  }

  const previous = (await readManifest(projectPath))?.plugins ?? [];
  const currentAndroid = androidPlugins(current);

  for (const android of currentAndroid) {
    await copySources(androidPath, android);
  }
  await removeGoneSources(androidPath, previous, currentAndroid);
  await writePluginRegistry(androidPath, currentAndroid);
  await wireMainActivity(androidPath, currentAndroid);
  await writeManifest(projectPath, current);

  logger.verbose(`Synced ${currentAndroid.length} Android plugin(s)`);
}

/** Syncs only when the installed plugins differ from the ones the last sync recorded. */
export async function syncAndroidPluginsIfNeeded(projectPath: string): Promise<void> {
  const plugins = await discoverPlugins(projectPath);
  if (!needsSync(await readManifest(projectPath), plugins)) {
    logger.verbose('Plugins up to date, skipping sync');
    return;
  }
  await syncAndroidPlugins(projectPath, plugins);
}
