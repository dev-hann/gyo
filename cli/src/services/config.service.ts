import * as path from 'path';
import { readJson, writeJson, pathExists } from '../utils/fs';
import { logger } from '../utils/logger';
import { GyoConfig, GyoError, getErrorMessage } from '../core/index';

export { GyoConfig } from '../core/index';

function validateServerUrl(url: unknown): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  return url.startsWith('http://') || url.startsWith('https://');
}

function validateNonEmptyUrl(url: string, context: string): string {
  if (!url || url.trim() === '') {
    logger.error(`${context} is empty in gyo.config.json`);
    throw new GyoError(`${context} cannot be empty`);
  }
  return url;
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

  if (typeof obj.platforms !== 'object' || obj.platforms === null) {
    errors.push("'platforms' must be an object");
  } else {
    const platforms = obj.platforms as Record<string, unknown>;
    if (platforms.android !== undefined) {
      validatePlatform(platforms.android, 'android', 'packageName', errors);
    }
    if (platforms.ios !== undefined) {
      validatePlatform(platforms.ios, 'ios', 'bundleId', errors);
    }
  }

  if (obj.serverUrl !== undefined) {
    if (!validateServerUrl(obj.serverUrl)) {
      errors.push("'serverUrl' must be a string starting with http:// or https://");
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

export async function loadConfig(projectPath: string = process.cwd()): Promise<GyoConfig | null> {
  const configPath = path.join(projectPath, 'gyo.config.json');

  if (!(await pathExists(configPath))) {
    logger.error(`gyo.config.json not found in: ${projectPath}`);
    return null;
  }

  try {
    const raw = await readJson(configPath);
    if (!validateConfig(raw)) {
      const errors = collectConfigErrors(raw);
      logger.error('Invalid gyo.config.json:');
      for (const err of errors) {
        logger.error(`  - ${err}`);
      }
      return null;
    }
    return raw;
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`Failed to load config: ${message}`);
    return null;
  }
}

export async function saveConfig(
  config: GyoConfig,
  projectPath: string = process.cwd()
): Promise<void> {
  const configPath = path.join(projectPath, 'gyo.config.json');
  await writeJson(configPath, config);
}

export function getProfileUrl(config: GyoConfig, profile: string = 'development'): string {
  if (config.profiles && config.profiles[profile]) {
    const serverUrl = config.profiles[profile].serverUrl;
    return validateNonEmptyUrl(serverUrl, `Profile '${profile}' serverUrl`);
  }

  if (config.serverUrl) {
    logger.warn('Using legacy serverUrl. Consider migrating to profiles in gyo.config.json');
    return validateNonEmptyUrl(config.serverUrl, 'serverUrl');
  }

  logger.error(`Profile '${profile}' not found in gyo.config.json`);
  const availableProfiles = config.profiles ? Object.keys(config.profiles) : [];
  if (availableProfiles.length > 0) {
    logger.error(`Available profiles: ${availableProfiles.join(', ')}`);
  }
  throw new GyoError(`Profile '${profile}' not found`);
}

export function shouldStartLocalServer(
  _config: GyoConfig,
  profile: string = 'development'
): boolean {
  return profile === 'development';
}
