import * as path from 'path';
import { readJson, writeJson, pathExists } from '../utils/fs';
import type { GyoConfig } from '../core/index';
import { GyoError, getErrorMessage } from '../core/index';

export type { GyoConfig } from '../core/index';

function validateServerUrl(url: unknown): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  return url.startsWith('http://') || url.startsWith('https://');
}

function validatePlatform(
  platform: unknown,
  platformName: string,
  idProperty: string,
  errors: string[]
): void {
  if (typeof platform !== 'object' || platform === null) {
    errors.push(`'platforms.${platformName}' must be an object`);
  } else {
    const platformObj = platform as Record<string, unknown>;
    if (typeof platformObj.enabled !== 'boolean') {
      errors.push(`'platforms.${platformName}.enabled' must be a boolean`);
    }
    if (platformObj[idProperty] !== undefined && typeof platformObj[idProperty] !== 'string') {
      errors.push(`'platforms.${platformName}.${idProperty}' must be a string`);
    }
  }
}

function validateAndroidExtras(android: unknown, errors: string[]): void {
  if (typeof android !== 'object' || android === null) {
    return;
  }
  const { versionCode, icon } = android as Record<string, unknown>;
  if (
    versionCode !== undefined &&
    (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1)
  ) {
    errors.push("'platforms.android.versionCode' must be a positive integer");
  }
  if (icon !== undefined && typeof icon !== 'string') {
    errors.push("'platforms.android.icon' must be a string");
  }
}

function collectConfigErrors(raw: unknown): string[] {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    errors.push('config must be a non-null object');
    return errors;
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    errors.push("'name' must be a non-empty string");
  }
  if (typeof obj.version !== 'string' || obj.version.trim() === '') {
    errors.push("'version' must be a non-empty string");
  }
  if (
    obj.displayName !== undefined &&
    (typeof obj.displayName !== 'string' || obj.displayName.trim() === '')
  ) {
    errors.push("'displayName' must be a non-empty string");
  }

  if (typeof obj.platforms !== 'object' || obj.platforms === null) {
    errors.push("'platforms' must be an object");
  } else {
    const platforms = obj.platforms as Record<string, unknown>;
    if (platforms.android !== undefined) {
      validatePlatform(platforms.android, 'android', 'packageName', errors);
      validateAndroidExtras(platforms.android, errors);
    }
    if (platforms.ios !== undefined) {
      validatePlatform(platforms.ios, 'ios', 'bundleId', errors);
    }
  }

  if (obj.profiles !== undefined) {
    if (typeof obj.profiles !== 'object' || obj.profiles === null) {
      errors.push("'profiles' must be an object");
    } else {
      for (const [key, value] of Object.entries(obj.profiles as Record<string, unknown>)) {
        if (typeof value !== 'object' || value === null) {
          errors.push(`'profiles.${key}' must be an object`);
        } else {
          const profile = value as Record<string, unknown>;
          if (!validateServerUrl(profile.serverUrl)) {
            errors.push(
              `'profiles.${key}.serverUrl' must be a string starting with http:// or https://`
            );
          }
        }
      }
    }
  }

  return errors;
}

export function validateConfig(raw: unknown): raw is GyoConfig {
  return collectConfigErrors(raw).length === 0;
}

function invalidConfigError(raw: unknown): GyoError {
  const errors = collectConfigErrors(raw).map((err) => `  - ${err}`);
  return new GyoError(`Invalid gyo.config.json:\n${errors.join('\n')}`);
}

/** The parsed gyo.config.json, valid or not. */
async function readConfigFile(projectPath: string): Promise<unknown> {
  const configPath = path.join(projectPath, 'gyo.config.json');

  if (!(await pathExists(configPath))) {
    throw new GyoError(`gyo.config.json not found in: ${projectPath}`);
  }

  try {
    return await readJson(configPath);
  } catch (error) {
    const message = getErrorMessage(error);
    throw new GyoError(`Failed to load config: ${message}`, 1, { cause: error });
  }
}

export async function loadConfig(projectPath: string = process.cwd()): Promise<GyoConfig> {
  const raw = await readConfigFile(projectPath);
  if (!validateConfig(raw)) {
    throw invalidConfigError(raw);
  }
  return raw;
}

const TRUE_VALUES = ['true', 'yes', '1', 'on'];
const FALSE_VALUES = ['false', 'no', '0', 'off'];

/** `text` as a boolean or a number when it reads as one. */
function convertLiteral(text: string): string | number | boolean {
  const lower = text.toLowerCase();
  if (TRUE_VALUES.includes(lower)) {
    return true;
  }
  if (FALSE_VALUES.includes(lower)) {
    return false;
  }
  return text.trim() !== '' && !isNaN(Number(text)) ? Number(text) : text;
}

/**
 * Sets `key` (dot notation) in gyo.config.json and returns what it was and
 * what it is now. The value takes the type of the one it replaces, so
 * `version 2` cannot turn a string into a number; a new key is read as a
 * boolean or a number. Nothing is written unless the result is a valid
 * config, which also makes this the way to repair an invalid one.
 */
export async function setConfigValue(
  projectPath: string,
  key: string,
  value: string
): Promise<{ previous: unknown; next: string | number | boolean }> {
  const raw = await readConfigFile(projectPath);
  if (typeof raw !== 'object' || raw === null) {
    throw invalidConfigError(raw);
  }

  const keys = key.split('.');
  let parent = raw as Record<string, unknown>;

  for (const segment of keys.slice(0, -1)) {
    const next: unknown = parent[segment];
    if (typeof next !== 'object' || next === null) {
      throw new GyoError(`Invalid configuration key: ${key}`);
    }
    parent = next as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  const previous = parent[lastKey];
  const next = typeof previous === 'string' ? value : convertLiteral(value);
  parent[lastKey] = next;

  if (!validateConfig(raw)) {
    throw invalidConfigError(raw);
  }
  await saveConfig(raw, projectPath);

  return { previous, next };
}

export async function saveConfig(
  config: GyoConfig,
  projectPath: string = process.cwd()
): Promise<void> {
  const configPath = path.join(projectPath, 'gyo.config.json');
  await writeJson(configPath, config);
}

export function shouldStartLocalServer(profile: string = 'development'): boolean {
  return profile === 'development';
}
