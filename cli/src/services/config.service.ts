import * as path from 'path';
import { readJson, writeJson, pathExists } from '../utils/fs';
import { logger } from '../utils/logger';
import { GyoConfig, GyoError } from '../core/index';

export { GyoConfig } from '../core/index';

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
      if (typeof platforms.android !== 'object' || platforms.android === null) {
        errors.push("'platforms.android' must be an object");
      } else {
        const android = platforms.android as Record<string, unknown>;
        if (typeof android.enabled !== 'boolean') {
          errors.push("'platforms.android.enabled' must be a boolean");
        }
        if (android.packageName !== undefined && typeof android.packageName !== 'string') {
          errors.push("'platforms.android.packageName' must be a string");
        }
      }
    }
    if (platforms.ios !== undefined) {
      if (typeof platforms.ios !== 'object' || platforms.ios === null) {
        errors.push("'platforms.ios' must be an object");
      } else {
        const ios = platforms.ios as Record<string, unknown>;
        if (typeof ios.enabled !== 'boolean') {
          errors.push("'platforms.ios.enabled' must be a boolean");
        }
        if (ios.bundleId !== undefined && typeof ios.bundleId !== 'string') {
          errors.push("'platforms.ios.bundleId' must be a string");
        }
      }
    }
  }

  if (obj.serverUrl !== undefined) {
    if (typeof obj.serverUrl !== 'string') {
      errors.push("'serverUrl' must be a string");
    } else if (!obj.serverUrl.startsWith('http://') && !obj.serverUrl.startsWith('https://')) {
      errors.push('serverUrl must start with http:// or https://');
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
          if (typeof profile.serverUrl !== 'string') {
            errors.push(`'profiles.${key}.serverUrl' must be a string`);
          } else if (
            !profile.serverUrl.startsWith('http://') &&
            !profile.serverUrl.startsWith('https://')
          ) {
            errors.push(`'profiles.${key}.serverUrl' must start with http:// or https://`);
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
    const message = error instanceof Error ? error.message : String(error);
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
    if (!serverUrl || serverUrl.trim() === '') {
      logger.error(`Profile '${profile}' has empty serverUrl in gyo.config.json`);
      throw new GyoError(`Profile '${profile}' serverUrl cannot be empty`);
    }
    return serverUrl;
  }

  if (config.serverUrl) {
    logger.warn('Using legacy serverUrl. Consider migrating to profiles in gyo.config.json');
    if (!config.serverUrl || config.serverUrl.trim() === '') {
      logger.error('serverUrl is empty in gyo.config.json');
      throw new GyoError('serverUrl cannot be empty');
    }
    return config.serverUrl;
  }

  logger.error(`Profile '${profile}' not found in gyo.config.json`);
  const availableProfiles = config.profiles ? Object.keys(config.profiles) : [];
  if (availableProfiles.length > 0) {
    logger.error(`Available profiles: ${availableProfiles.join(', ')}`);
  }
  throw new GyoError(`Profile '${profile}' not found`);
}

export function shouldStartLocalServer(
  config: GyoConfig,
  profile: string = 'development'
): boolean {
  return profile === 'development';
}
