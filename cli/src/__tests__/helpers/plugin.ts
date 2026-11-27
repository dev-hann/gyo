import * as path from 'path';
import fs from 'fs-extra';
import type { DiscoveredPlugin } from '../../services/plugin.service';

const ANDROID_TEMPLATE = path.join(__dirname, '../../../templates/android');

export const APP_LAUNCHER_HANDLER = 'gyo.plugins.app_launcher.AppLauncherBridge';
export const COMMUNICATION_HANDLER = 'gyo.plugins.communication.CommunicationBridge';

export interface PluginFixtureOptions {
  /** Permissions the plugin declares under `gyo.android.permissions`. */
  permissions?: string[];
  /** False leaves the sources without a Gradle module file. */
  module?: boolean;
}

/**
 * Lays a plugin out the way the published ones are: package.json with a
 * `gyo` field, and an android/ library module with the handler's sources.
 */
export function writePluginFixture(
  projectPath: string,
  name: string,
  handlerClass: string,
  bridgeName: string,
  options: PluginFixtureOptions = {}
): DiscoveredPlugin {
  const pluginPath = path.join(projectPath, 'lib', 'node_modules', ...name.split('/'));
  const segments = handlerClass.split('.');
  const className = segments[segments.length - 1];
  const androidPath = path.join(pluginPath, 'android');

  fs.outputFileSync(
    path.join(androidPath, 'src/main/kotlin', ...segments.slice(0, -1), `${className}.kt`),
    `class ${className}\n`
  );
  fs.outputFileSync(
    path.join(androidPath, 'src/main/AndroidManifest.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<manifest />\n'
  );
  if (options.module !== false) {
    fs.outputFileSync(
      path.join(androidPath, 'build.gradle.kts'),
      'plugins { id("com.android.library") }\n'
    );
  }

  const android: { handlerClass: string; permissions?: string[] } = { handlerClass };
  if (options.permissions) {
    android.permissions = options.permissions;
  }
  fs.outputJsonSync(path.join(pluginPath, 'package.json'), {
    name,
    version: '0.1.0',
    gyo: { bridgeName, android },
  });

  return {
    name,
    version: '0.1.0',
    path: pluginPath,
    meta: { bridgeName, android },
    hasAndroid: true,
    hasIOS: false,
  };
}

/** The file `gyo create` writes for a placeholder, read from the template. */
function templateFile(relativePath: string): string {
  return fs.readFileSync(path.join(ANDROID_TEMPLATE, relativePath), 'utf-8');
}

/**
 * Writes the Android shell `gyo create` gives a project: the template, with
 * its placeholders replaced.
 */
export function writeAndroidShell(projectPath: string, packageName: string): string {
  const androidPath = path.join(projectPath, 'android');
  fs.copySync(ANDROID_TEMPLATE, androidPath);

  const replace = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        replace(entryPath);
      } else if (!entry.name.endsWith('.jar')) {
        const content = fs
          .readFileSync(entryPath, 'utf-8')
          .replace(/\{\{PACKAGE_NAME\}\}/g, packageName)
          .replace(/\{\{PROJECT_NAME\}\}/g, 'demo');
        fs.writeFileSync(entryPath, content);
      }
    }
  };
  replace(androidPath);

  return androidPath;
}

export function androidFilePath(projectPath: string, ...relativePath: string[]): string {
  return path.join(projectPath, 'android', ...relativePath);
}

export function registryRelativePath(): string {
  return path.join('app/src/main/java/gyo/plugins/bridge', 'PluginRegistry.kt');
}

/** The empty registry, as the template ships it and as a sync writes it. */
export function emptyRegistry(): string {
  return templateFile(registryRelativePath());
}
