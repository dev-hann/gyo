import * as path from 'path';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import { AbstractRunCommand } from './AbstractRunCommand';
import { CommandMeta } from '../base/BaseCommand';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists } from '../../utils/fs';
import { CommandNotFoundError, BuildFailedError } from '../../core/errors';

export class AndroidRunCommand extends AbstractRunCommand {
  getMeta(): CommandMeta {
    return { name: 'run-android', description: '' };
  }

  protected async runPlatform(serverUrl: string): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    await this.checkPlatformDirectoryExists();
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
    if (!(await this.checkCommandExists('adb'))) {
      this.failSpinner('adb not found');
      logger.error('Please install Android SDK and add adb to your PATH');
      throw new CommandNotFoundError('adb');
    }
  }

  private async updateServerUrl(androidPath: string, serverUrl: string): Promise<void> {
    this.updateSpinner(`Updating server URL to ${serverUrl}...`);

    const assetsPath = path.join(androidPath, 'app/src/main/assets');
    const configPath = path.join(assetsPath, 'gyo-config.json');

    await fs.ensureDir(assetsPath);

    const config = {
      serverUrl: serverUrl,
    };

    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  private async getConnectedDevice(): Promise<string> {
    return this.options.device || '';
  }

  private async buildApp(androidPath: string): Promise<void> {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

    this.updateSpinner('Building Android app...');
    const buildResult = await executeCommand(gradlew, ['assembleDebug'], {
      cwd: androidPath,
      stdio: 'pipe',
    });

    if (!buildResult.success) {
      this.failSpinner('Build failed');
      throw new BuildFailedError('Android build failed');
    }
  }

  private async installApp(androidPath: string): Promise<void> {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

    this.updateSpinner('Installing app on device...');
    const installResult = await executeCommand(gradlew, ['installDebug'], {
      cwd: androidPath,
      stdio: 'pipe',
    });

    if (!installResult.success) {
      this.failSpinner('Failed to install app');
      logger.error(installResult.stderr || installResult.stdout);
      throw new BuildFailedError('Failed to install app');
    }
  }

  private async getPackageName(androidPath: string): Promise<string | null> {
    try {
      const buildGradlePath = path.join(androidPath, 'app/build.gradle');
      if (!(await pathExists(buildGradlePath))) {
        return null;
      }

      const content = await fs.readFile(buildGradlePath, 'utf-8');
      const match = content.match(/applicationId\s+"([^"]+)"/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  private async launchApp(packageName: string | null, selectedDevice: string): Promise<void> {
    this.updateSpinner('Launching app...');
    if (packageName && selectedDevice) {
      const launchArgs = [
        '-s',
        selectedDevice,
        'shell',
        'am',
        'start',
        '-n',
        `${packageName}/.MainActivity`,
      ];
      const launchResult = await executeCommand('adb', launchArgs, {
        stdio: 'pipe',
      });

      if (launchResult.success) {
        this.succeedSpinner('App installed and launched on Android device!');
      } else {
        this.succeedSpinner('App installed on Android device!');
        logger.warn('Could not auto-launch app. Please launch manually.');
      }
    } else {
      this.succeedSpinner('App installed on Android device!');
    }
  }

  protected async monitorLogs(identifier: string): Promise<void> {
    const logcatArgs = ['logcat', '-v', 'brief', '-s', 'WebView-Console:*'];
    if (identifier) {
      logcatArgs.unshift('-s', identifier);
    }

    this.platformProcess = spawn('adb', logcatArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.platformProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim() && line.includes('WebView-Console')) {
          const match = line.match(/WebView-Console:\s*(.+?)\s*(?:--\s*From line|$)/);
          if (match) {
            logger.info(`📱 ${match[1]}`);
          } else {
            logger.info(`📱 ${line.trim()}`);
          }
        }
      }
    });

    this.platformProcess.stderr?.on('data', () => {});

    return new Promise<void>((resolve, reject) => {
      if (!this.platformProcess) {
        resolve();
        return;
      }

      this.platformProcess.on('exit', (code) => {
        if (!this.isCleaningUp && code !== 0) {
          logger.warn('Log monitoring stopped');
        }
        resolve();
      });

      this.platformProcess.on('error', (error) => {
        if (!this.isCleaningUp) {
          logger.error(`Log monitoring error: ${error.message}`);
          reject(error);
        }
      });
    });
  }
}
