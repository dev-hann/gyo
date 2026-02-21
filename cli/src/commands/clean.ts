import { Command } from "commander";
import * as path from "path";
import ora from "ora";
import { logger } from "../utils/logger.js";
import { executeCommand } from "../utils/exec.js";
import { pathExists, removeDir } from "../utils/fs.js";
import { getGradlew } from "../utils/command-utils.js";
import { GyoError, InvalidPlatformError } from "../utils/errors.js";

const VALID_PLATFORMS = ["android", "ios", "lib", "all"];

export function registerCleanCommand(program: Command): void {
  program
    .command("clean [platform]")
    .description("Clean build artifacts (android, ios, lib, or all)")
    .action(async (platform?: string) => {
      await cleanPlatform(platform || "all");
    });
}

async function cleanPlatform(platform: string): Promise<void> {
  const spinner = ora("Cleaning build artifacts...").start();

  try {
    if (!VALID_PLATFORMS.includes(platform)) {
      spinner.fail(`Invalid platform: ${platform}`);
      throw new InvalidPlatformError(platform, VALID_PLATFORMS.slice(0, -1));
    }

    const platforms = platform === "all" ? ["android", "ios", "lib"] : [platform];

    await Promise.all(
      platforms.map(p => cleanSinglePlatform(spinner, p))
    );

    spinner.succeed("Clean complete!");
  } catch (error) {
    if (error instanceof GyoError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(`Clean failed: ${message}`);
    throw new GyoError(message);
  }
}

async function cleanSinglePlatform(spinner: ora.Ora, platform: string): Promise<void> {
  switch (platform) {
    case "android":
      await cleanAndroid(spinner);
      break;
    case "ios":
      await cleanIOS(spinner);
      break;
    case "lib":
      await cleanLib(spinner);
      break;
  }
}

async function cleanAndroid(spinner: ora.Ora): Promise<void> {
  const androidPath = path.join(process.cwd(), "android");

  if (!(await pathExists(androidPath))) {
    logger.warn("Android project not found, skipping");
    return;
  }

  spinner.text = "Cleaning Android build...";

  const gradlew = getGradlew();
  const cleanResult = await executeCommand(gradlew, ["clean"], {
    cwd: androidPath,
    stdio: "pipe",
  });

  if (!cleanResult.success) {
    logger.warn("Android clean failed");
    logger.error(cleanResult.stderr);
  } else {
    logger.success("Android build cleaned");
  }

  const buildPath = path.join(androidPath, "app/build");
  if (await pathExists(buildPath)) {
    await removeDir(buildPath);
  }
}

async function cleanIOS(spinner: ora.Ora): Promise<void> {
  const iosPath = path.join(process.cwd(), "ios");

  if (!(await pathExists(iosPath))) {
    logger.warn("iOS project not found, skipping");
    return;
  }

  spinner.text = "Cleaning iOS build...";

  const cleanupTasks: Promise<void>[] = [];

  const buildPath = path.join(iosPath, "build");
  if (await pathExists(buildPath)) {
    cleanupTasks.push(removeDir(buildPath).then(() => logger.success("iOS build cleaned")));
  }

  const podsPath = path.join(iosPath, "Pods");
  if (await pathExists(podsPath)) {
    cleanupTasks.push(removeDir(podsPath).then(() => logger.success("iOS Pods cleaned")));
  }

  await Promise.all(cleanupTasks);
}

async function cleanLib(spinner: ora.Ora): Promise<void> {
  const libPath = path.join(process.cwd(), "lib");

  if (!(await pathExists(libPath))) {
    logger.warn("Lib project not found, skipping");
    return;
  }

  spinner.text = "Cleaning lib build...";

  const cleanupTasks: Promise<void>[] = [];

  const distPath = path.join(libPath, "dist");
  if (await pathExists(distPath)) {
    cleanupTasks.push(removeDir(distPath));
  }

  const nodeModulesPath = path.join(libPath, "node_modules");
  if (await pathExists(nodeModulesPath)) {
    cleanupTasks.push(removeDir(nodeModulesPath));
  }

  await Promise.all(cleanupTasks);
  logger.success("Lib build cleaned");
}
