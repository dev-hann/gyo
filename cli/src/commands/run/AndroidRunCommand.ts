import * as path from 'path';
import { spawn } from 'child_process';
import { AbstractRunCommand } from './AbstractRunCommand';
import type { Platform } from '../base/index';
import { logger, EMOJI } from '../../utils/logger';
import { executeCommand, getGradlew, requireTool } from '../../utils/exec';
import { pathExists, readFile } from '../../utils/fs';
import { BuildFailedError, getErrorMessage } from '../../core/errors';
import { syncAndroidAppIdentity, toAndroidAppIdentity } from '../../services/android-shell.service';
import { syncAndroidPluginsIfNeeded } from '../../services/plugin.service';

export class AndroidRunCommand extends AbstractRunCommand {
  protected platform: Platform = 'android';

  protected async runPlatform(serverUrl: string): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    await this.checkPlatformDirectoryExists();
    await this.checkAdbAvailable();
    await this.updateServerUrl(androidPath, serverUrl);
    await syncAndroidPluginsIfNeeded(this.projectPath);
    await syncAndroidAppIdentity(androidPath, toAndroidAppIdentity(this.config, this.projectPath));

    const selectedDevice = this.options.device || '';
    await this.buildApp(androidPath);
    await this.installApp(androidPath);
    const packageName = await this.getPackageName(androidPath);
    await this.launchApp(packageName, selectedDevice);
    this.showSuccessMessage(serverUrl);
    await this.monitorLogs(selectedDevice);
  }

  private async checkAdbAvailable(): Promise<void> {
    await requireTool('adb', 'Install the Android SDK and add adb to your PATH. Run: gyo doctor');
  }

  private async updateServerUrl(androidPath: string, serverUrl: string): Promise<void> {
    const configPath = path.join(androidPath, 'app/src/main/assets/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl, this.config.webview);
  }

  private async buildApp(androidPath: string): Promise<void> {
    const gradlew = getGradlew();

    this.updateSpinner('Building Android app (this may take a few minutes)...');
    const buildResult = await executeCommand(gradlew, ['assembleDebug'], {
      cwd: androidPath,
      stdio: 'pipe',
    });

    if (!buildResult.success) {
      this.failSpinner('Build failed');
      const output = buildResult.stderr || buildResult.stdout || '';
      logger.error(output);
      if (output.includes('SDK location not found')) {
        logger.error('Set ANDROID_HOME or create android/local.properties with sdk.dir=<path>');
        logger.info("Run 'gyo doctor' to check your environment.");
      }
      throw new BuildFailedError('Android build failed');
    }
  }

  private async installApp(androidPath: string): Promise<void> {
    const gradlew = getGradlew();

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

      const content = await readFile(buildGradlePath);
      // AGP 9 has Gradle write `applicationId = "..."`; older projects wrote `applicationId "..."`.
      const match = content.match(/applicationId\s*=?\s*"([^"]+)"/);
      return match ? match[1] : null;
    } catch (error) {
      const message = getErrorMessage(error);
      logger.debug(`Failed to read package name from build.gradle: ${message}`);
      logger.warn('Auto-launch may not work. Launch the app manually on your device.');
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

  protected monitorLogs(identifier: string): Promise<void> {
    const device = identifier ? ['-s', identifier] : [];
    this.platformProcess = spawn(
      'adb',
      [...device, 'logcat', '-v', 'brief', '-s', 'WebView-Console:*'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    return this.followLogProcess(this.platformProcess, (line, stream) => {
      if (stream === 'stderr') {
        logger.warn(line);
        return;
      }
      // `adb logcat -v brief` prefixes each line with the tag and the
      // process, and WebView appends where the line came from.
      const message = line
        .replace(/^.*?WebView-Console(?:\(\s*\d+\))?:\s*/, '')
        .replace(/\s*--\s*From line \d+ of \S+$/, '');
      logger.info(`${EMOJI.PHONE} ${message}`);
    });
  }
}
