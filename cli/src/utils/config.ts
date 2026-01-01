import * as path from 'path';
import { readJson, writeJson, pathExists } from './fs';
import { logger } from './logger';

export interface ProfileConfig {
  webviewUrl: string;
}

export interface GyoConfig {
  name: string;
  version: string;
  serverUrl?: string; // Legacy - deprecated, use profiles instead
  profiles?: {
    [key: string]: ProfileConfig;
  };
  platforms: {
    android?: {
      enabled: boolean;
      packageName?: string;
    };
    ios?: {
      enabled: boolean;
      bundleId?: string;
    };
  };
  webview?: {
    allowFileAccess?: boolean;
    allowUniversalAccessFromFileURLs?: boolean;
    userAgent?: string;
  };
}

export const DEFAULT_CONFIG: GyoConfig = {
  name: 'gyo-app',
  version: '1.0.0',
  profiles: {
    development: {
      webviewUrl: 'http://localhost:3000'
    },
    production: {
      webviewUrl: 'https://your-production-url.com'
    }
  },
  platforms: {
    android: {
      enabled: true,
      packageName: 'com.example.gyoapp'
    },
    ios: {
      enabled: true,
      bundleId: 'com.example.gyoapp'
    }
  },
  webview: {
    allowFileAccess: false,
    allowUniversalAccessFromFileURLs: false
  }
};

export async function loadConfig(projectPath: string = process.cwd()): Promise<GyoConfig | null> {
  const configPath = path.join(projectPath, 'gyo.config.json');
  
  if (!(await pathExists(configPath))) {
    logger.error('gyo.config.json not found in the current directory');
    return null;
  }
  
  try {
    const config = await readJson(configPath);
    return config as GyoConfig;
  } catch (error) {
    logger.error(`Failed to load config: ${error}`);
    return null;
  }
}

export async function saveConfig(config: GyoConfig, projectPath: string = process.cwd()): Promise<void> {
  const configPath = path.join(projectPath, 'gyo.config.json');
  await writeJson(configPath, config);
}

export function validateConfig(config: GyoConfig): boolean {
  if (!config.name || !config.version) {
    logger.error('Config must have name and version');
    return false;
  }
  
  if (!config.profiles && !config.serverUrl) {
    logger.error('Config must have either profiles or serverUrl (legacy)');
    return false;
  }
  
  if (!config.platforms || Object.keys(config.platforms).length === 0) {
    logger.error('Config must have at least one platform enabled');
    return false;
  }
  
  return true;
}

export function getProfileUrl(config: GyoConfig, profile: string = 'development'): string {
  if (config.profiles && config.profiles[profile]) {
    return config.profiles[profile].webviewUrl;
  }
  
  if (config.serverUrl) {
    logger.warn('Using legacy serverUrl. Consider migrating to profiles in gyo.config.json');
    return config.serverUrl;
  }
  
  logger.error(`Profile '${profile}' not found in gyo.config.json`);
  throw new Error(`Profile '${profile}' not found`);
}
