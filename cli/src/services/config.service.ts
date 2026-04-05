import * as path from 'path';
import { readJson, writeJson, pathExists } from '../utils/fs';
import { logger } from '../utils/logger';
import { GyoConfig } from '../core/index';

export { GyoConfig } from '../core/index';

export function validateConfig(raw: unknown): raw is GyoConfig {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.trim() === '') return false;
  if (typeof obj.version !== 'string' || obj.version.trim() === '') return false;

  if (typeof obj.platforms !== 'object' || obj.platforms === null) return false;

  if (obj.serverUrl !== undefined && typeof obj.serverUrl !== 'string') return false;

  if (obj.profiles !== undefined) {
    if (typeof obj.profiles !== 'object' || obj.profiles === null) return false;
    for (const value of Object.values(obj.profiles as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) return false;
      const profile = value as Record<string, unknown>;
      if (typeof profile.serverUrl !== 'string') return false;
    }
  }

  return true;
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
      logger.error(
        'Invalid gyo.config.json: missing or invalid required fields (name, version, platforms)'
      );
      return null;
    }
    return raw;
  } catch (error) {
    logger.error(`Failed to load config: ${error}`);
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
      throw new Error(`Profile '${profile}' serverUrl cannot be empty`);
    }
    return serverUrl;
  }

  if (config.serverUrl) {
    logger.warn('Using legacy serverUrl. Consider migrating to profiles in gyo.config.json');
    if (!config.serverUrl || config.serverUrl.trim() === '') {
      logger.error('serverUrl is empty in gyo.config.json');
      throw new Error('serverUrl cannot be empty');
    }
    return config.serverUrl;
  }

  logger.error(`Profile '${profile}' not found in gyo.config.json`);
  throw new Error(`Profile '${profile}' not found`);
}

export function shouldStartLocalServer(
  config: GyoConfig,
  profile: string = 'development'
): boolean {
  return profile === 'development';
}
