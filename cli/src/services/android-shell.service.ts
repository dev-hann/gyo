import * as path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger';
import { ensureDir, pathExists, readFile, writeFile } from '../utils/fs';
import { BuildFailedError } from '../core/index';
import type { GyoConfig } from '../core/index';

/** What gyo.config.json says the Android app is: its version, name and icon. */
export interface AndroidAppIdentity {
  versionName: string;
  versionCode?: number;
  displayName?: string;
  /** Absolute path of a PNG used as the launcher icon. */
  iconPath?: string;
}

export interface KeystoreProperties {
  storeFile: string;
  storePassword: string;
  keyAlias: string;
  keyPassword: string;
}

type Environment = Record<string, string | undefined>;

const GRADLE_FILE = 'app/build.gradle';
const VERSION_CODE = /versionCode(\s*=?\s*)\d+/;
const VERSION_NAME = /versionName(\s*=?\s*)"[^"]*"/;
const STRINGS_FILE = 'app/src/main/res/values/strings.xml';
const MANIFEST_FILE = 'app/src/main/AndroidManifest.xml';
const LAUNCHER_ICON_FILE = 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';
const KEYSTORE_PROPERTIES_FILE = 'keystore.properties';

const SIGNING_ENV_VARS = {
  storeFile: 'GYO_ANDROID_KEYSTORE_PATH',
  storePassword: 'GYO_ANDROID_KEYSTORE_PASSWORD',
  keyAlias: 'GYO_ANDROID_KEY_ALIAS',
  keyPassword: 'GYO_ANDROID_KEY_PASSWORD',
} as const;

export function toXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escapes a value for a Java `.properties` file. Java reads the file as
 * ISO 8859-1, so a character outside it is written the way Java writes one.
 */
export function toJavaPropertyValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/^ /, '\\ ')
    .replace(
      /[^\x20-\x7e]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
}

export function renderKeystoreProperties(properties: KeystoreProperties): string {
  return (
    (['storeFile', 'storePassword', 'keyAlias', 'keyPassword'] as const)
      .map((key) => `${key}=${toJavaPropertyValue(properties[key])}`)
      .join('\n') + '\n'
  );
}

/**
 * Reads the release signing material from the environment. Returns undefined
 * when none of the variables is set and throws when only some of them are.
 */
export function readSigningFromEnv(env: Environment): KeystoreProperties | undefined {
  const entries = (Object.keys(SIGNING_ENV_VARS) as (keyof KeystoreProperties)[]).map(
    (key) => [key, env[SIGNING_ENV_VARS[key]]] as const
  );

  const provided = entries.filter(([, value]) => value !== undefined && value.trim() !== '');
  if (provided.length === 0) {
    return undefined;
  }
  if (provided.length < entries.length) {
    throw new BuildFailedError(
      `Release signing needs all four of ${Object.values(SIGNING_ENV_VARS).join(', ')}.`
    );
  }

  const [storeFile, storePassword, keyAlias, keyPassword] = provided.map(
    ([, value]) => value?.trim() ?? ''
  );
  return { storeFile, storePassword, keyAlias, keyPassword };
}

/**
 * Makes sure a release build can be signed before Gradle runs. The signing
 * material never belongs in gyo.config.json: it comes from the environment,
 * which is written to the ignored keystore.properties, or from that file
 * created by hand.
 */
export async function prepareReleaseSigning(
  androidPath: string,
  env: Environment = process.env
): Promise<void> {
  const propertiesPath = path.join(androidPath, KEYSTORE_PROPERTIES_FILE);
  const fromEnv = readSigningFromEnv(env);

  if (!fromEnv) {
    if (await pathExists(propertiesPath)) {
      return;
    }
    throw new BuildFailedError(
      [
        'Release signing is not configured. Either',
        `  set ${Object.values(SIGNING_ENV_VARS).join(', ')}, or`,
        `  create ${propertiesPath}:`,
        '    storeFile=release.keystore',
        '    storePassword=...',
        '    keyAlias=...',
        '    keyPassword=...',
        'storeFile is resolved relative to android/app/.',
      ].join('\n')
    );
  }

  // Gradle resolves storeFile from the app module.
  const keystorePath = path.resolve(androidPath, 'app', fromEnv.storeFile);
  if (!(await pathExists(keystorePath))) {
    throw new BuildFailedError(`Release keystore not found: ${keystorePath}`);
  }

  await writeFile(propertiesPath, renderKeystoreProperties(fromEnv));
  logger.verbose(`Wrote ${propertiesPath} from the environment`);
}

export function toAndroidAppIdentity(config: GyoConfig, projectPath: string): AndroidAppIdentity {
  const android = config.platforms.android;
  return {
    versionName: config.version,
    versionCode: android?.versionCode,
    displayName: config.displayName,
    iconPath: android?.icon ? path.resolve(projectPath, android.icon) : undefined,
  };
}

/**
 * Rewrites the generated Android project so that its version, label and icon
 * match gyo.config.json. Runs before every build, so editing the config is
 * enough; the generated files are never edited by hand.
 */
export async function syncAndroidAppIdentity(
  androidPath: string,
  identity: AndroidAppIdentity
): Promise<void> {
  await syncGradleVersion(
    path.join(androidPath, GRADLE_FILE),
    identity.versionName,
    identity.versionCode
  );

  if (identity.displayName !== undefined) {
    await syncLabel(androidPath, identity.displayName);
  }

  if (identity.iconPath) {
    await syncIcon(androidPath, identity.iconPath);
  }
}

async function syncGradleVersion(
  gradlePath: string,
  versionName: string,
  versionCode?: number
): Promise<void> {
  const gradle = await readFile(gradlePath);
  let next = gradle;

  // Groovy accepts `versionCode 1` and `versionCode = 1`; a project made by
  // an earlier gyo has the first, the template now has the second. Keep each.
  if (versionCode !== undefined) {
    if (!VERSION_CODE.test(next)) {
      throw new BuildFailedError(`${gradlePath} has no "versionCode <number>" line to update.`);
    }
    next = next.replace(
      VERSION_CODE,
      (_match, assignment: string) => `versionCode${assignment}${versionCode}`
    );
  }

  if (!VERSION_NAME.test(next)) {
    throw new BuildFailedError(`${gradlePath} has no "versionName" line to update.`);
  }
  next = next.replace(VERSION_NAME, (_match, assignment: string) => {
    const quoted = versionName.replace(/[\\"]/g, '\\$&');
    return `versionName${assignment}"${quoted}"`;
  });

  await writeFile(gradlePath, next);
}

async function syncLabel(androidPath: string, label: string): Promise<void> {
  const stringsPath = path.join(androidPath, STRINGS_FILE);
  const strings = await readFile(stringsPath);
  const pattern = /(<string\s+name="app_name">)[^<]*(<\/string>)/;
  if (!pattern.test(strings)) {
    throw new BuildFailedError(`${stringsPath} has no app_name string to update.`);
  }
  // A replacement function: in a replacement string, `$` names a group.
  await writeFile(
    stringsPath,
    strings.replace(
      pattern,
      (_match, opening: string, closing: string) => `${opening}${toXmlText(label)}${closing}`
    )
  );

  // Projects created by earlier versions put the project name straight into
  // the manifest, where no edit to strings.xml would show.
  const manifestPath = path.join(androidPath, MANIFEST_FILE);
  const manifest = await readFile(manifestPath);
  if (manifest.includes('android:label="@string/app_name"')) {
    return;
  }
  if (!/android:label="[^"]*"/.test(manifest)) {
    throw new BuildFailedError(`${manifestPath} has no android:label attribute to update.`);
  }
  await writeFile(
    manifestPath,
    manifest.replace(/android:label="[^"]*"/, 'android:label="@string/app_name"')
  );
}

async function syncIcon(androidPath: string, iconPath: string): Promise<void> {
  if (!/\.png$/i.test(iconPath)) {
    throw new BuildFailedError(`The launcher icon must be a PNG file: ${iconPath}`);
  }
  if (!(await pathExists(iconPath))) {
    throw new BuildFailedError(`Launcher icon not found: ${iconPath}`);
  }

  // Only the xxxhdpi bucket is written; Android scales it for other densities.
  const target = path.join(androidPath, LAUNCHER_ICON_FILE);
  await ensureDir(path.dirname(target));
  await fs.copy(iconPath, target, { overwrite: true });

  const manifestPath = path.join(androidPath, MANIFEST_FILE);
  const manifest = await readFile(manifestPath);
  if (!/android:icon="[^"]*"/.test(manifest)) {
    throw new BuildFailedError(`${manifestPath} has no android:icon attribute to update.`);
  }
  await writeFile(
    manifestPath,
    manifest.replace(/android:icon="[^"]*"/, 'android:icon="@mipmap/ic_launcher"')
  );
}
