import * as path from "path";
import { spawn } from "child_process";
import fs from "fs-extra";
import { AbstractRunCommand } from "./AbstractRunCommand.js";
import { logger } from "../../utils/logger.js";
import { executeCommand } from "../../utils/exec.js";
import { pathExists, readFile, writeFile } from "../../utils/fs.js";

export class AndroidRunCommand extends AbstractRunCommand {
  protected async runPlatform(serverUrl: string): Promise<void> {
    const androidPath = path.join(this.projectPath, "android");

    await this.checkPlatformExists("android");
    await this.checkAdbAvailable();
    await this.updateServerUrl(androidPath, serverUrl);
    const selectedDevice = await this.getConnectedDevice();
    await this.buildApp(androidPath);
    await this.installApp(androidPath);
    const packageName = await this.getPackageName(androidPath);
    await this.launchApp(packageName, selectedDevice);
    this.showSuccessMessage(serverUrl);
    await this.monitorLogs(selectedDevice);
  }

  private async checkAdbAvailable(): Promise<void> {
    if (!(await this.checkCommandExists("adb"))) {
      this.spinner.fail("adb not found");
      logger.error("Please install Android SDK and add adb to your PATH");
      process.exit(1);
    }
  }

  private async updateServerUrl(
    androidPath: string,
    serverUrl: string
  ): Promise<void> {
    this.spinner.text = `Updating server URL to ${serverUrl}...`;

    // Update assets/gyo-config.json
    const assetsPath = path.join(androidPath, "app/src/main/assets");
    const configPath = path.join(assetsPath, "gyo-config.json");

    // Ensure assets directory exists
    await fs.ensureDir(assetsPath);

    // Create or update gyo-config.json
    const config = {
      serverUrl: serverUrl,
    };

    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  private async getConnectedDevice(): Promise<string> {
    // Device is already selected in run.ts
    return this.options.device;
  }

  private async buildApp(androidPath: string): Promise<void> {
    const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

    this.spinner.text = "Building Android app...";
    const buildResult = await executeCommand(gradlew, ["assembleDebug"], {
      cwd: androidPath,
      stdio: "pipe",
    });

    if (!buildResult.success) {
      this.spinner.fail("Build failed");
      process.exit(1);
    }
  }

  private async installApp(androidPath: string): Promise<void> {
    const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

    this.spinner.text = "Installing app on device...";
    const installResult = await executeCommand(gradlew, ["installDebug"], {
      cwd: androidPath,
      stdio: "pipe",
    });

    if (!installResult.success) {
      this.spinner.fail("Failed to install app");
      logger.error(installResult.stderr || installResult.stdout);
      process.exit(1);
    }
  }

  private async getPackageName(androidPath: string): Promise<string | null> {
    try {
      const buildGradlePath = path.join(androidPath, "app/build.gradle");
      if (!(await pathExists(buildGradlePath))) {
        return null;
      }

      const content = await fs.readFile(buildGradlePath, "utf-8");
      const match = content.match(/applicationId\s+"([^"]+)"/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  private async launchApp(
    packageName: string | null,
    selectedDevice: string
  ): Promise<void> {
    this.spinner.text = "Launching app...";
    if (packageName && selectedDevice) {
      const launchArgs = [
        "-s",
        selectedDevice,
        "shell",
        "am",
        "start",
        "-n",
        `${packageName}/.MainActivity`,
      ];
      const launchResult = await executeCommand("adb", launchArgs, {
        stdio: "pipe",
      });

      if (launchResult.success) {
        this.spinner.succeed("App installed and launched on Android device!");
      } else {
        this.spinner.succeed("App installed on Android device!");
        logger.warn("Could not auto-launch app. Please launch manually.");
      }
    } else {
      this.spinner.succeed("App installed on Android device!");
    }
  }

  private showSuccessMessage(serverUrl: string): void {
    logger.log("");
    logger.success(`App is connected to: ${serverUrl}`);
    logger.info("Monitoring console logs (Press Ctrl+C to stop)...");
    logger.log("");
  }

  private async monitorLogs(selectedDevice: string): Promise<void> {
    const logcatArgs = ["logcat", "-v", "brief", "-s", "WebView-Console:*"];
    if (selectedDevice) {
      logcatArgs.unshift("-s", selectedDevice);
    }

    this.platformProcess = spawn("adb", logcatArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.platformProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim() && line.includes("WebView-Console")) {
          const match = line.match(
            /WebView-Console:\s*(.+?)\s*(?:--\s*From line|$)/
          );
          if (match) {
            console.log(`📱 ${match[1]}`);
          } else {
            console.log(`📱 ${line.trim()}`);
          }
        }
      }
    });

    this.platformProcess.stderr?.on("data", (data: Buffer) => {
      // Ignore stderr for logcat
    });

    this.platformProcess.on("exit", (code) => {
      if (!this.isCleaningUp && code !== 0) {
        logger.warn("Log monitoring stopped");
      }
    });

    await new Promise(() => {});
  }
}
