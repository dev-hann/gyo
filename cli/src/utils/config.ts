import * as path from 'path';
import { readJson, writeJson, pathExists } from './fs';
import { logger } from './logger';

export interface GyoConfig {
  name: string;
  version: string;
  serverUrl: string;
  platforms: {
    android?: {
      enabled: boolean;
      packageName?: string;
    };
    ios?: {
      enabled: boolean;
      bundleId?: string;
    };
    desktop?: {
      enabled: boolean;
    };
  };
  webview?: {
    allowFileAccess?: boolean;
    allowUniversalAccessFromFileURLs?: boolean;
    userAgent?: string;
  };
  devServer?: {
    port?: number;
    host?: string;
  };
}

export const DEFAULT_CONFIG: GyoConfig = {
  name: 'gyo-app',
  version: '1.0.0',
  serverUrl: 'http://localhost:3000',
  platforms: {
    android: {
      enabled: true,
      packageName: 'com.example.gyoapp'
    },
    ios: {
      enabled: true,
      bundleId: 'com.example.gyoapp'
    },
    desktop: {
      enabled: false
    }
  },
  webview: {
    allowFileAccess: false,
    allowUniversalAccessFromFileURLs: false
  },
  devServer: {
    port: 3000,
    host: 'localhost'
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
  if (!config.name || !config.version || !config.serverUrl) {
    logger.error('Config must have name, version, and serverUrl');
    return false;
  }
  
  if (!config.platforms || Object.keys(config.platforms).length === 0) {
    logger.error('Config must have at least one platform enabled');
    return false;
  }
  
  return true;
}
