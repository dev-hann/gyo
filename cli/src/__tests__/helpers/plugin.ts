import * as path from 'path';
import fs from 'fs-extra';
import type { DiscoveredPlugin } from '../../services/plugin.service';

export const TEMPLATE_ACTIVITY = path.join(
  __dirname,
  '../../../templates/android/app/src/main/kotlin/{{PACKAGE_NAME}}/MainActivity.kt'
);

export const APP_LAUNCHER_HANDLER = 'gyo.plugins.app_launcher.AppLauncherBridge';
export const SMS_SENDER_HANDLER = 'gyo.plugins.sms_sender.SmsSenderBridge';

/**
 * Lays a plugin into a project the way the published ones are laid out:
 * package.json with a `gyo` field, sources under android/src/main/kotlin.
 */
export function writePluginFixture(
  projectPath: string,
  name: string,
  handlerClass: string,
  bridgeName: string
): DiscoveredPlugin {
  const pluginPath = path.join(projectPath, 'lib', 'node_modules', ...name.split('/'));
  const segments = handlerClass.split('.');
  const className = segments[segments.length - 1];

  fs.outputFileSync(
    path.join(pluginPath, 'android/src/main/kotlin', ...segments.slice(0, -1), `${className}.kt`),
    `class ${className}\n`
  );
  fs.outputJsonSync(path.join(pluginPath, 'package.json'), {
    name,
    version: '0.1.0',
    gyo: { bridgeName, android: { handlerClass } },
  });

  return {
    name,
    version: '0.1.0',
    path: pluginPath,
    meta: { bridgeName, android: { handlerClass } },
    hasAndroid: true,
    hasIOS: false,
  };
}

/** Writes the template MainActivity.kt of a generated project. */
export function writeMainActivity(projectPath: string, packageName: string): string {
  const content = fs
    .readFileSync(TEMPLATE_ACTIVITY, 'utf-8')
    .replace(/\{\{PACKAGE_NAME\}\}/g, packageName);

  const activityPath = path.join(
    projectPath,
    'android/app/src/main/java',
    ...packageName.split('.'),
    'MainActivity.kt'
  );
  fs.outputFileSync(activityPath, content);

  return activityPath;
}

/** Path of a handler's sources once they are synced into the Android project. */
export function syncedHandlerSources(projectPath: string, handlerClass: string): string {
  return path.join(
    projectPath,
    'android/app/src/main/java',
    ...handlerClass.split('.').slice(0, -1)
  );
}
