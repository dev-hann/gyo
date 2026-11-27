import * as path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger';
import { pathExists, readJson } from '../utils/fs';
import { GyoError } from '../core/errors';

export interface GyoPluginAndroid {
  /** Fully qualified class that implements `gyo.plugins.bridge.BridgeHandler`. */
  handlerClass: string;
  /**
   * Android permissions the handler needs at run time. The app declares them
   * in its own AndroidManifest.xml; a sync points out the ones missing there.
   */
  permissions?: string[];
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
  /** How the sync wired the plugins up; a migration keys on it. */
  model?: string;
  plugins: DiscoveredPlugin[];
}

/** A plugin together with its Android module, as the app's Gradle build sees it. */
interface AndroidPlugin {
  plugin: DiscoveredPlugin;
  handlerClass: string;
  /** Name of the plugin's Gradle project in the app build. */
  project: string;
  /** The module directory, relative to android/ and with forward slashes. */
  moduleDir: string;
  /** The module's Gradle build file, Groovy or Kotlin. */
  buildFile: string;
  permissions: string[];
}

const GRADLE_MODULE_MODEL = 'gradle-module';
const GYO_PLUGIN_SCOPES = ['@gyo-framework', '@gyo-community'];
const MANIFEST_FILE = '.gyo-plugins';
const PLUGIN_REGISTRY_PACKAGE = 'gyo.plugins.bridge';
const PLUGIN_REGISTRY_CLASS = 'PluginRegistry';
const GRADLE_MODULE_FILES = ['android/build.gradle.kts', 'android/build.gradle'];
const BRIDGE_MODULE_FILE = 'gyo-bridge/build.gradle';
const SETTINGS_FILE = 'gyo.settings.gradle';
const APP_GRADLE_FILE = 'gyo.build.gradle';
const APP_MANIFEST_FILE = 'app/src/main/AndroidManifest.xml';
const JAVA_SOURCE_ROOT = 'app/src/main/java';
const GENERATED_BY =
  '// Written by gyo. DO NOT EDIT: gyo run, gyo build and gyo install rewrite it before every build.';
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ANDROID_PERMISSION = /^android\.permission\.[A-Z_]+$/;

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
      // npm link, pnpm and workspaces keep packages as symlinks.
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

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

/** The name of the Gradle project that the app build includes a plugin as. */
function gradleProjectName(pluginName: string): string {
  const slug =
    pluginName
      .split('/')
      .pop()
      ?.replace(/[^A-Za-z0-9_-]/g, '-') ?? '';
  if (!slug) {
    throw new GyoError(`"${pluginName}" cannot be turned into a Gradle project name.`);
  }
  return `gyo-plugin-${slug}`;
}

/** A path as it goes into a Groovy string literal: forward slashes, whatever the platform. */
function gradlePath(target: string): string {
  return target.split(path.sep).join('/').replace(/'/g, "\\'");
}

/**
 * Reads a plugin's Android module. A declared module that cannot be read
 * fails the sync: going on would only leave the Gradle build broken.
 */
async function toAndroidPlugin(
  plugin: DiscoveredPlugin,
  androidPath: string
): Promise<AndroidPlugin | null> {
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

  const buildFiles = GRADLE_MODULE_FILES.map((file) => path.join(plugin.path, file));
  const buildFile = (await Promise.all(buildFiles.map(pathExists))).findIndex(Boolean);
  if (buildFile === -1) {
    throw new GyoError(
      `${plugin.name} has Android sources but no ${GRADLE_MODULE_FILES.join(' or ')}: ` +
        'it is not a library module the app build can include.'
    );
  }

  const permissions = plugin.meta.android?.permissions ?? [];
  if (!Array.isArray(permissions) || permissions.some((p) => !ANDROID_PERMISSION.test(p))) {
    throw new GyoError(`${plugin.name} declares permissions that are not Android permissions.`);
  }

  // node_modules may keep a symlink; Gradle needs the directory itself.
  const realModule = fs.realpathSync(path.join(plugin.path, 'android'));

  return {
    plugin,
    handlerClass,
    project: gradleProjectName(plugin.name),
    moduleDir: gradlePath(path.relative(androidPath, realModule)),
    buildFile: buildFiles[buildFile],
    permissions: permissions as string[],
  };
}

/** Where a handler's sources were copied to by syncs before plugin modules. */
function copiedHandlerFile(androidPath: string, handlerClass: string): string {
  const segments = handlerClass.split('.');
  return path.join(androidPath, JAVA_SOURCE_ROOT, ...segments.slice(0, -1), `${segments.pop()}.kt`);
}

/**
 * Checks that the Android project can include plugin modules, and that
 * nothing in it will clash with them once they are compiled.
 */
async function requireModuleShell(androidPath: string, plugins: AndroidPlugin[]): Promise<void> {
  if (!(await pathExists(path.join(androidPath, BRIDGE_MODULE_FILE)))) {
    throw new GyoError(
      `The Android project in ${androidPath} predates plugin modules: it has no gyo-bridge/ module.\n` +
        '  See "Plugin modules" in docs/CLI.md for how to bring it up to date.'
    );
  }

  const settings = await fs.readFile(path.join(androidPath, 'settings.gradle'), 'utf-8');
  const appGradle = await fs.readFile(path.join(androidPath, 'app', 'build.gradle'), 'utf-8');
  if (!settings.includes(SETTINGS_FILE) || !appGradle.includes(APP_GRADLE_FILE)) {
    throw new GyoError(
      `settings.gradle must apply ${SETTINGS_FILE} and app/build.gradle must apply ${APP_GRADLE_FILE}: ` +
        'they are what include the plugins. See "Plugin modules" in docs/CLI.md.'
    );
  }

  const duplicates: string[] = [];
  for (const { handlerClass } of plugins) {
    const copied = copiedHandlerFile(androidPath, handlerClass);
    if (await pathExists(copied)) {
      duplicates.push(path.relative(androidPath, copied));
    }
  }
  if (duplicates.length > 0) {
    throw new GyoError(
      'These files duplicate classes the plugins now bring themselves; delete them:\n' +
        duplicates.map((file) => `  ${file}`).join('\n')
    );
  }
}

/** Deletes what syncs before plugin modules copied into the app. */
async function removeCopiedSources(
  androidPath: string,
  manifest: PluginManifest | null
): Promise<void> {
  if (!manifest || manifest.model === GRADLE_MODULE_MODEL) {
    return;
  }
  for (const plugin of manifest.plugins) {
    const handlerClass = plugin.meta.android?.handlerClass;
    if (typeof handlerClass !== 'string') continue;

    const segments = handlerClass.split('.');
    const copiedDir = path.join(androidPath, JAVA_SOURCE_ROOT, ...segments.slice(0, -1));
    if (await pathExists(copiedDir)) {
      await fs.remove(copiedDir);
      logger.verbose(`Removed the sources an earlier gyo copied for ${plugin.name}`);
    }
  }
}

function renderSettings(plugins: AndroidPlugin[]): string {
  const lines = [
    GENERATED_BY,
    '',
    '// Every plugin installed in lib/ is one Gradle module, included from where node_modules keeps it.',
  ];
  if (plugins.length > 0) {
    lines.push('');
  }
  for (const { project, moduleDir } of plugins) {
    lines.push(`include ':${project}'`, `project(':${project}').projectDir = file('${moduleDir}')`);
  }
  return `${lines.join('\n')}\n`;
}

function renderAppGradle(plugins: AndroidPlugin[]): string {
  const lines = [
    GENERATED_BY,
    '',
    '// The app depends on the module of every plugin installed in lib/.',
  ];
  if (plugins.length > 0) {
    lines.push(
      '',
      'dependencies {',
      ...plugins.map(({ project }) => `    implementation project(':${project}')`),
      '}'
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * A module may depend on the module of another plugin, which it names as
 * gyo includes it. That plugin has to be installed too.
 */
async function requireInstalledNeighbours(plugins: AndroidPlugin[]): Promise<void> {
  const installed = new Set(plugins.map(({ project }) => project));

  for (const { plugin, buildFile } of plugins) {
    const gradle = await fs.readFile(buildFile, 'utf-8');
    for (const [, slug] of gradle.matchAll(/project\(":gyo-plugin-([a-z0-9_-]+)"\)/g)) {
      if (!installed.has(`gyo-plugin-${slug}`)) {
        throw new GyoError(
          `${plugin.name} needs the plugin that gyo includes as gyo-plugin-${slug}; install it in lib/ too.`
        );
      }
    }
  }
}

function registryFile(androidPath: string): string {
  return path.join(
    androidPath,
    JAVA_SOURCE_ROOT,
    ...PLUGIN_REGISTRY_PACKAGE.split('.'),
    `${PLUGIN_REGISTRY_CLASS}.kt`
  );
}

/** The registry of the app module. With no plugin it is the one the template ships. */
function renderRegistry(plugins: AndroidPlugin[]): string {
  const imports = new Set<string>();
  const registrations: string[] = [];

  for (const { handlerClass, plugin } of plugins) {
    imports.add(`import ${handlerClass}`);
    registrations.push(
      `        BridgeRegistry.register("${plugin.meta.bridgeName}", ${handlerClass.split('.').pop()}(context))`
    );
  }
  if (plugins.length > 0) {
    imports.add(`import ${PLUGIN_REGISTRY_PACKAGE}.BridgeRegistry`);
  }

  const body =
    plugins.length === 0
      ? ['    @Suppress("UNUSED_PARAMETER")', '    fun registerAll(context: Context) {}']
      : ['    fun registerAll(context: Context) {', ...registrations, '    }'];

  const lines = [
    `package ${PLUGIN_REGISTRY_PACKAGE}`,
    '',
    'import android.content.Context',
    ...Array.from(imports).sort(),
    '',
    '/**',
    ' * Registers every Gyo plugin the project has installed. gyo run, gyo build',
    ' * and gyo install rewrite it; handlers of your own belong elsewhere.',
    ' */',
    `object ${PLUGIN_REGISTRY_CLASS} {`,
    ...body,
    '}',
  ];
  return `${lines.join('\n')}\n`;
}

/** Writes a generated file, leaving it alone when its content would not change. */
async function writeGenerated(file: string, content: string): Promise<void> {
  if ((await pathExists(file)) && (await fs.readFile(file, 'utf-8')) === content) {
    return;
  }
  await fs.outputFile(file, content);
}

/**
 * Points out the run-time permissions the installed plugins need that the
 * app does not declare. The app declares them on purpose: they are its decision.
 */
async function warnAboutMissingPermissions(
  androidPath: string,
  plugins: AndroidPlugin[]
): Promise<void> {
  if (plugins.every(({ permissions }) => permissions.length === 0)) {
    return;
  }

  const manifest = await fs.readFile(path.join(androidPath, APP_MANIFEST_FILE), 'utf-8');
  for (const { plugin, permissions } of plugins) {
    const missing = permissions.filter(
      (permission) => !manifest.includes(`android:name="${permission}"`)
    );
    if (missing.length > 0) {
      logger.warn(
        `${plugin.name} needs ${missing.join(', ')}. Add ${missing.length > 1 ? 'them' : 'it'} to ${APP_MANIFEST_FILE}; ` +
          'the system asks the user at run time.'
      );
    }
  }
}

export async function readManifest(projectPath: string): Promise<PluginManifest | null> {
  const manifestPath = path.join(projectPath, MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    return null;
  }
  try {
    const manifest = (await readJson(manifestPath)) as PluginManifest;
    return {
      model: manifest.model,
      plugins: Array.isArray(manifest.plugins) ? manifest.plugins : [],
    };
  } catch {
    return null;
  }
}

export async function writeManifest(
  projectPath: string,
  plugins: DiscoveredPlugin[]
): Promise<void> {
  const manifest: PluginManifest = {
    model: GRADLE_MODULE_MODEL,
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
  if (!manifest || manifest.model !== GRADLE_MODULE_MODEL) return true;

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
 * Makes the app's Gradle build include the Android module of every plugin
 * installed in lib/, and registers their handlers. Each plugin is one
 * library module, so Gradle's manifest merger brings in what the module
 * declares and the module brings its own dependencies. A plugin that cannot
 * be included fails the sync: going on would only move the failure into the
 * Gradle build.
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

  const manifest = await readManifest(projectPath);
  const modules = (await Promise.all(current.map((plugin) => toAndroidPlugin(plugin, androidPath))))
    .filter((module): module is AndroidPlugin => module !== null)
    .sort((a, b) => a.project.localeCompare(b.project));

  const projects = new Set<string>();
  for (const { project, plugin } of modules) {
    if (projects.has(project)) {
      throw new GyoError(`Two plugins are included as :${project}, starting with ${plugin.name}.`);
    }
    projects.add(project);
  }

  await removeCopiedSources(androidPath, manifest);
  if (modules.length > 0) {
    await requireModuleShell(androidPath, modules);
    await requireInstalledNeighbours(modules);
  }

  await writeGenerated(path.join(androidPath, SETTINGS_FILE), renderSettings(modules));
  await writeGenerated(path.join(androidPath, 'app', APP_GRADLE_FILE), renderAppGradle(modules));
  await writeGenerated(registryFile(androidPath), renderRegistry(modules));
  await writeManifest(projectPath, current);
  await warnAboutMissingPermissions(androidPath, modules);

  logger.verbose(`Included ${modules.length} Android plugin module(s)`);
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
