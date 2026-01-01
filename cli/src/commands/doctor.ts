import { Command } from "commander";
import { logger } from "../utils/logger";
import { checkCommandExists, executeCommand } from "../utils/exec";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check your environment for required dependencies")
    .action(async () => {
      await runDoctor();
    });
}

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  optional?: boolean;
}

async function runDoctor(): Promise<void> {
  logger.info("Running gyo environment checks...\n");

  const results: CheckResult[] = [];

  results.push(await checkNodeJS());
  results.push(await checkNPM());
  results.push(await checkGit());

  logger.info("\nAndroid Development:");
  results.push(await checkAndroidSDK());
  results.push(await checkADB());
  results.push(await checkGradle());

  logger.info("\niOS Development:");
  results.push(await checkSwift());
  results.push(await checkXtool());
  results.push(await checkLibimobiledevice());

  logger.info("\nDesktop Development:");
  results.push(await checkElectron());

  logger.info("\n" + "=".repeat(50));
  logger.info("Summary:\n");

  const passed = results.filter((r) => r.passed && !r.optional).length;
  const total = results.filter((r) => !r.optional).length;
  const optional = results.filter((r) => r.optional);

  results.forEach((result) => {
    if (result.passed) {
      logger.success(`${result.name}: ${result.message}`);
    } else {
      if (result.optional) {
        logger.warn(`${result.name}: ${result.message} (optional)`);
      } else {
        logger.error(`${result.name}: ${result.message}`);
      }
    }
  });

  logger.info("\n" + "=".repeat(50));
  logger.info(`\nPassed: ${passed}/${total} required checks`);

  if (optional.length > 0) {
    const passedOptional = optional.filter((r) => r.passed).length;
    logger.info(`Optional: ${passedOptional}/${optional.length} checks`);
  }

  if (passed === total) {
    logger.success("\nYour environment is ready for gyo development!");
  } else {
    logger.warn("\nSome checks failed. Please fix the issues above.");
  }
}

async function checkNodeJS(): Promise<CheckResult> {
  const exists = await checkCommandExists("node");
  if (!exists) {
    return {
      name: "Node.js",
      passed: false,
      message: "Not installed. Visit https://nodejs.org",
    };
  }

  const result = await executeCommand("node", ["--version"], { stdio: "pipe" });
  const version = result.stdout.trim();
  const majorVersion = parseInt(version.replace("v", "").split(".")[0]);

  if (majorVersion >= 18) {
    return {
      name: "Node.js",
      passed: true,
      message: `${version} installed`,
    };
  } else {
    return {
      name: "Node.js",
      passed: false,
      message: `${version} installed (requires v18 or higher)`,
    };
  }
}

async function checkNPM(): Promise<CheckResult> {
  const exists = await checkCommandExists("npm");
  if (!exists) {
    return {
      name: "npm",
      passed: false,
      message: "Not installed",
    };
  }

  const result = await executeCommand("npm", ["--version"], { stdio: "pipe" });
  return {
    name: "npm",
    passed: true,
    message: `v${result.stdout.trim()} installed`,
  };
}

async function checkGit(): Promise<CheckResult> {
  const exists = await checkCommandExists("git");
  if (!exists) {
    return {
      name: "Git",
      passed: false,
      message: "Not installed",
      optional: true,
    };
  }

  const result = await executeCommand("git", ["--version"], { stdio: "pipe" });
  return {
    name: "Git",
    passed: true,
    message: result.stdout.trim(),
    optional: true,
  };
}

async function checkAndroidSDK(): Promise<CheckResult> {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

  if (!androidHome) {
    return {
      name: "Android SDK",
      passed: false,
      message: "ANDROID_HOME not set",
      optional: true,
    };
  }

  return {
    name: "Android SDK",
    passed: true,
    message: `Found at ${androidHome}`,
    optional: true,
  };
}

async function checkADB(): Promise<CheckResult> {
  const exists = await checkCommandExists("adb");
  if (!exists) {
    return {
      name: "ADB",
      passed: false,
      message: "Not found in PATH",
      optional: true,
    };
  }

  const result = await executeCommand("adb", ["--version"], { stdio: "pipe" });
  return {
    name: "ADB",
    passed: true,
    message: "Installed",
    optional: true,
  };
}

async function checkGradle(): Promise<CheckResult> {
  const exists = await checkCommandExists("gradle");
  return {
    name: "Gradle",
    passed: exists,
    message: exists ? "Installed" : "Not found (will use gradlew)",
    optional: true,
  };
}

async function checkSwift(): Promise<CheckResult> {
  const exists = await checkCommandExists("swift");
  if (!exists) {
    return {
      name: "Swift",
      passed: false,
      message: "Not installed. Required for iOS development",
      optional: true,
    };
  }

  const result = await executeCommand("swift", ["--version"], {
    stdio: "pipe",
  });
  const versionMatch = result.stdout.match(/Swift version ([\d.]+)/);
  const version = versionMatch ? versionMatch[1] : "Installed";

  return {
    name: "Swift",
    passed: true,
    message: `Version ${version}`,
    optional: true,
  };
}

async function checkXtool(): Promise<CheckResult> {
  const exists = await checkCommandExists("xtool");
  if (!exists) {
    return {
      name: "xtool",
      passed: false,
      message:
        "Not installed. Visit https://xtool.sh for cross-platform iOS builds",
      optional: true,
    };
  }

  const result = await executeCommand("xtool", ["--version"], {
    stdio: "pipe",
  });
  const version = result.stdout.trim();
  return {
    name: "xtool",
    passed: true,
    message: version || "Installed",
    optional: true,
  };
}

async function checkLibimobiledevice(): Promise<CheckResult> {
  const exists = await checkCommandExists("idevice_id");
  if (!exists) {
    return {
      name: "libimobiledevice",
      passed: false,
      message:
        "Not installed. Required for iOS device communication (idevicesyslog, etc.)",
      optional: true,
    };
  }

  const tools = [
    "idevice_id",
    "ideviceinfo",
    "idevicesyslog",
    "ideviceimagemounter",
  ];
  const installedTools = [];

  for (const tool of tools) {
    if (await checkCommandExists(tool)) {
      installedTools.push(tool);
    }
  }

  return {
    name: "libimobiledevice",
    passed: true,
    message: `Installed (${installedTools.length}/${tools.length} tools available)`,
    optional: true,
  };
}

async function checkElectron(): Promise<CheckResult> {
  return {
    name: "Electron/Tauri",
    passed: true,
    message: "Will be installed per-project",
    optional: true,
  };
}
