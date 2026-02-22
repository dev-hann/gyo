import * as path from "path";
import { readJson, writeJson, pathExists } from "../utils/fs.js";
import { logger } from "../utils/logger.js";
import { GyoConfig, DEFAULT_CONFIG } from "../core/index.js";

export { GyoConfig, DEFAULT_CONFIG } from "../core/index.js";

export async function loadConfig(
  projectPath: string = process.cwd()
): Promise<GyoConfig | null> {
  const configPath = path.join(projectPath, "gyo.config.json");

  if (!(await pathExists(configPath))) {
    logger.error(`gyo.config.json not found in: ${projectPath}`);
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

export async function saveConfig(
  config: GyoConfig,
  projectPath: string = process.cwd()
): Promise<void> {
  const configPath = path.join(projectPath, "gyo.config.json");
  await writeJson(configPath, config);
}

export function getProfileUrl(
  config: GyoConfig,
  profile: string = "development"
): string {
  if (config.profiles && config.profiles[profile]) {
    const serverUrl = config.profiles[profile].serverUrl;
    if (!serverUrl || serverUrl.trim() === "") {
      logger.error(
        `Profile '${profile}' has empty serverUrl in gyo.config.json`
      );
      throw new Error(`Profile '${profile}' serverUrl cannot be empty`);
    }
    return serverUrl;
  }

  if (config.serverUrl) {
    logger.warn(
      "Using legacy serverUrl. Consider migrating to profiles in gyo.config.json"
    );
    if (!config.serverUrl || config.serverUrl.trim() === "") {
      logger.error("serverUrl is empty in gyo.config.json");
      throw new Error("serverUrl cannot be empty");
    }
    return config.serverUrl;
  }

  logger.error(`Profile '${profile}' not found in gyo.config.json`);
  throw new Error(`Profile '${profile}' not found`);
}

export function shouldStartLocalServer(
  config: GyoConfig,
  profile: string = "development"
): boolean {
  return profile === "development";
}
