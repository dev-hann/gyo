import * as path from 'path';
import { spawn } from 'child_process';
import { AbstractRunCommand } from './AbstractRunCommand';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists, readFile, writeFile } from '../../utils/fs';

export class AndroidRunCommand extends AbstractRunCommand {
  protected async runPlatform(serverUrl: string): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    await this.checkPlatformExists('android');
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
      this.spinner.fail('adb not found');
      logger.error('Please install Android SDK and add adb to your PATH');
      process.exit(1);
    }
  }

  private async updateServerUrl(androidPath: string, serverUrl: string): Promise<void> {
    this.spinner.text = `Updating server URL to ${serverUrl}...`;
    const mainActivityPath = path.join(androidPath, 'app/src/main/java/com/example');

    const fs = require('fs-extra');
    const findMainActivity = async (dir: string): Promise<string | null> => {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          const result = await findMainActivity(filePath);
          if (result) return result;
        } else if (file === 'MainActivity.kt') {
          return filePath;
        }
      }
      return null;
    };

    const mainActivityFile = await findMainActivity(mainActivityPath);
    if (mainActivityFile) {
      let content = await readFile(mainActivityFile);
      content = content.replace(
        /serverUrl = "http:\/\/[^"]+"/,
        `serverUrl = "${serverUrl}"`
      );
      await writeFile(mainActivityFile, content);
    }
  }

  private async getConnectedDevice(): Promise<string> {
    this.spinner.text = 'Checking for connected devices...';
    const devicesResult = await executeCommand('adb', ['devices'], { stdio: 'pipe' });

    if (!devicesResult.success || !devicesResult.stdout.includes('device')) {
      this.spinner.fail('No Android devices found');
      logger.error('Connect a device or start an emulator');
      process.exit(1);
    }

    let selectedDevice = this.options.device;
    if (!selectedDevice) {
      const deviceLines = devicesResult.stdout.split('\n').filter(line => line.includes('\tdevice'));
      if (deviceLines.length > 0) {
        selectedDevice = deviceLines[0].split('\t')[0];
      }
    }

    if (!selectedDevice) {
      this.spinner.fail('No Android devices found');
      logger.error('Connect a device or start an emulator');
      process.exit(1);
    }

    return selectedDevice;
  }

  private async buildApp(androidPath: string): Promise<void> {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

    this.spinner.text = 'Building Android app...';
    const buildResult = await executeCommand(gradlew, ['assembleDebug'], {
      cwd: androidPath,
      stdio: 'pipe'
    });

    if (!buildResult.success) {
      this.spinner.fail('Build failed');
      process.exit(1);
    }
  }

  private async installApp(androidPath: string): Promise<void> {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

    this.spinner.text = 'Installing app on device...';
    const installResult = await executeCommand(gradlew, ['installDebug'], {
      cwd: androidPath,
      stdio: 'inherit'
    });

    if (!installResult.success) {
      this.spinner.fail('Failed to install app');
      process.exit(1);
    }
  }

  private async getPackageName(androidPath: string): Promise<string | null> {
    try {
      const buildGradlePath = path.join(androidPath, 'app/build.gradle');
      if (!(await pathExists(buildGradlePath))) {
        return null;
      }

      const content = await require('fs-extra').readFile(buildGradlePath, 'utf-8');
      const match = content.match(/applicationId\s+"([^"]+)"/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  private async launchApp(packageName: string | null, selectedDevice: string): Promise<void> {
    this.spinner.text = 'Launching app...';
    if (packageName && selectedDevice) {
      const launchArgs = ['-s', selectedDevice, 'shell', 'am', 'start', '-n', `${packageName}/.MainActivity`];
      const launchResult = await executeCommand('adb', launchArgs, { stdio: 'pipe' });

      if (launchResult.success) {
        this.spinner.succeed('App installed and launched on Android device!');
      } else {
        this.spinner.succeed('App installed on Android device!');
        logger.warn('Could not auto-launch app. Please launch manually.');
      }
    } else {
      this.spinner.succeed('App installed on Android device!');
    }
  }

  private showSuccessMessage(serverUrl: string): void {
    logger.log('');
    logger.success(`App is connected to: ${serverUrl}`);
    logger.info('Monitoring console logs (Press Ctrl+C to stop)...');
    logger.log('');
  }

  private async monitorLogs(selectedDevice: string): Promise<void> {
    const logcatArgs = ['logcat', '-v', 'brief', '-s', 'WebView-Console:*'];
    if (selectedDevice) {
      logcatArgs.unshift('-s', selectedDevice);
    }

    this.platformProcess = spawn('adb', logcatArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.platformProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim() && line.includes('WebView-Console')) {
          const match = line.match(/WebView-Console:\s*(.+?)\s*(?:--\s*From line|$)/);
          if (match) {
            console.log(`📱 ${match[1]}`);
          } else {
            console.log(`📱 ${line.trim()}`);
          }
        }
      }
    });

    this.platformProcess.stderr?.on('data', (data: Buffer) => {
      // Ignore stderr for logcat
    });

    this.platformProcess.on('exit', (code) => {
      if (!this.isCleaningUp && code !== 0) {
        logger.warn('Log monitoring stopped');
      }
    });

    await new Promise(() => {});
  }
}
