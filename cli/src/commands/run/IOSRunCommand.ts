import * as path from 'path';
import { spawn } from 'child_process';
import { AbstractRunCommand } from './AbstractRunCommand';
import type { CommandMeta } from '../base/BaseCommand';
import { logger, EMOJI } from '../../utils/logger';
import { executeCommand, requireTool, checkCommandExists } from '../../utils/exec';
import { pathExists, readFile, removeDir } from '../../utils/fs';
import { BuildFailedError, getErrorMessage } from '../../core/errors';
import { showXtoolError } from '../xtool-output';

const SYSLOG_SEARCH_TIMEOUT_MS = 2000;

/**
 * The value of a top-level `key` in a YAML file of plain `key: value`
 * lines, as YAML reads it: quotes and a trailing comment are not part of
 * the value, and a commented-out line says nothing. Empty when nothing
 * follows the key on its line, as for a nested mapping.
 */
function plainScalar(content: string, key: string): string | undefined {
  const startsTheKey = new RegExp(`^${key}\\s*:`);
  const line = content.split(/\r?\n/).find((entry) => startsTheKey.test(entry));
  if (line === undefined) {
    return undefined;
  }
  const value = line
    .replace(new RegExp(`^${key}\\s*:\\s*`), '')
    .replace(/\s+#.*$/, '')
    .trim();
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

export class IOSRunCommand extends AbstractRunCommand {
  getMeta(): CommandMeta {
    return { name: 'run-ios', description: 'Run iOS app' };
  }

  protected async runPlatform(serverUrl: string): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    await this.checkPlatformDirectoryExists();
    await this.checkXtoolAvailable();
    await this.updateServerUrl(iosPath, serverUrl);

    const bundleId = await this.getBundleId(iosPath);
    const finalBundleId = await this.buildAndInstallApp(iosPath, bundleId);

    this.showSuccessMessage(serverUrl);
    await this.monitorLogs(finalBundleId);
  }

  private async checkXtoolAvailable(): Promise<void> {
    await requireTool('xtool', 'Install xtool: https://xtool.sh');
  }

  private async updateServerUrl(iosPath: string, serverUrl: string): Promise<void> {
    const configPath = path.join(iosPath, 'Sources/Resources/gyo-config.json');
    await this.writeConfigFile(configPath, serverUrl);

    const buildPath = path.join(iosPath, '.build');
    if (await pathExists(buildPath)) {
      logger.verbose('Cleaning build cache...');
      await removeDir(buildPath);
    }
  }

  private async getBundleId(iosPath: string): Promise<string> {
    try {
      const xtoolYmlPath = path.join(iosPath, 'xtool.yml');
      if (!(await pathExists(xtoolYmlPath))) {
        logger.error('xtool.yml not found in ios directory');
        throw new BuildFailedError('xtool.yml not found in ios directory');
      }

      const content = await readFile(xtoolYmlPath);

      const value = plainScalar(content, 'bundleID');
      if (value === undefined) {
        logger.error('bundleID not found in xtool.yml');
        logger.error(`Check your xtool.yml file at: ${xtoolYmlPath}`);
        throw new BuildFailedError('bundleID not found in xtool.yml');
      }
      if (value === '') {
        logger.error('Invalid xtool.yml: bundleID should be a string value, not a mapping');
        logger.error('Expected format: bundleID: com.example.app');
        logger.error(`Check your xtool.yml file at: ${xtoolYmlPath}`);
        throw new BuildFailedError('Invalid xtool.yml: bundleID should be a string value');
      }
      const bundleId = value;
      if (bundleId.startsWith('{{') || bundleId.includes('{{')) {
        logger.error(`bundleID contains template variable: ${bundleId}`);
        logger.error('Template variables should have been replaced during project creation');
        logger.error(`Check your xtool.yml file at: ${xtoolYmlPath}`);
        throw new BuildFailedError('bundleID contains template variable');
      }

      return bundleId;
    } catch (error) {
      if (error instanceof BuildFailedError) {
        throw error;
      }
      logger.error(`Failed to read xtool.yml: ${getErrorMessage(error)}`);
      throw new BuildFailedError(`Failed to read xtool.yml: ${getErrorMessage(error)}`);
    }
  }

  private async buildAndInstallApp(iosPath: string, bundleId: string): Promise<string> {
    this.updateSpinner('Building and installing iOS app...');

    // The device `gyo run` chose; xtool picks one itself when none was.
    const device = this.options.device ? ['--udid', this.options.device] : [];
    const buildResult = await executeCommand('xtool', ['dev', ...device], {
      cwd: iosPath,
      stdio: 'pipe',
    });

    if (!buildResult.success) {
      this.failSpinner('Build failed');
      const errorOutput = buildResult.stderr || buildResult.stdout || 'Unknown error';

      showXtoolError(errorOutput);
      throw new BuildFailedError('iOS build failed');
    }

    this.updateSpinner('Finding installed app...');

    let fullBundleId = bundleId;
    const combinedOutput = (buildResult.stdout || '') + (buildResult.stderr || '');

    let match = combinedOutput.match(/bundleIDs\s*=\s*\(\s*"([^"]+)"/);
    if (match && match[1].includes(bundleId.split('.').pop() || '')) {
      fullBundleId = match[1];
    }

    if (fullBundleId === bundleId) {
      // The project's part may hold an underscore: `demo-app` becomes `com.example.demo_app`.
      match = combinedOutput.match(/(XTL-[A-Z0-9]+\.[a-z0-9._]+)/i);
      if (
        match &&
        match[1].toLowerCase().includes(bundleId.split('.').pop()?.toLowerCase() || '')
      ) {
        fullBundleId = match[1];
      }
    }

    if (fullBundleId === bundleId && (await checkCommandExists('idevicesyslog'))) {
      fullBundleId = await this.findBundleIdFromSyslog(bundleId);
    }

    if (fullBundleId !== bundleId) {
      logger.info(`Found full bundle ID: ${fullBundleId}`);
    }

    this.succeedSpinner('App installed on iOS device!');

    return fullBundleId;
  }

  private async findBundleIdFromSyslog(bundleId: string): Promise<string> {
    this.updateSpinner('Looking for installed app...');

    const syslogCapture = spawn('idevicesyslog', [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const safeBundleId = bundleId || '';

    const foundBundleId = await new Promise<string>((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let onDataCallback: ((data: Buffer) => void) | null = null;
      let onErrorCallback: ((error: Error) => void) | null = null;
      let onExitCallback: ((code: number | null) => void) | null = null;
      let finished = false;

      const cleanup = (): void => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        if (onDataCallback) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          syslogCapture.stdout?.off('data', onDataCallback);
          onDataCallback = null;
        }
        if (onErrorCallback) {
          syslogCapture.off('error', onErrorCallback);
          onErrorCallback = null;
        }
        if (onExitCallback) {
          syslogCapture.off('exit', onExitCallback);
          onExitCallback = null;
        }

        if (!syslogCapture.killed) {
          try {
            syslogCapture.kill('SIGTERM');
            const killTimeout = setTimeout(() => {
              if (!syslogCapture.killed) {
                syslogCapture.kill('SIGKILL');
              }
            }, 1000);
            killTimeout.unref();
          } catch (e) {
            logger.debug(`Error killing syslog capture: ${getErrorMessage(e)}`);
          }
        }
      };

      const finish = (result: string): void => {
        if (!finished) {
          finished = true;
          cleanup();
          resolve(result);
        }
      };

      onDataCallback = (data: Buffer): void => {
        const output = data.toString();
        const patterns = [
          new RegExp(`(XTL-[A-Z0-9]+\\.${safeBundleId.replace(/\./g, '\\.')})`, 'i'),
          new RegExp(`bundleID[^:]*:\\s*([^\\s,}"]+${safeBundleId.split('.').pop()})`, 'i'),
        ];

        for (const pattern of patterns) {
          const match = output.match(pattern);
          if (match) {
            finish(match[1]);
            return;
          }
        }
      };

      onErrorCallback = (): void => {
        finish(safeBundleId);
      };

      onExitCallback = (): void => {
        finish(safeBundleId);
      };

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      syslogCapture.stdout?.on('data', onDataCallback);
      syslogCapture.on('error', onErrorCallback);
      syslogCapture.on('exit', onExitCallback);

      timeout = setTimeout(() => finish(safeBundleId), SYSLOG_SEARCH_TIMEOUT_MS);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (timeout) {
        timeout.unref();
      }
    });

    return foundBundleId;
  }

  protected showSuccessMessage(serverUrl: string): void {
    logger.log('');
    logger.info(`${EMOJI.PHONE} Please tap the app icon on your device to launch it.`);
    logger.success(`App is connected to: ${serverUrl}`);
    logger.info('Monitoring console logs (Press Ctrl+C to stop)...');
    logger.log('');
  }

  protected async monitorLogs(identifier: string): Promise<void> {
    if (!(await checkCommandExists('idevicesyslog'))) {
      logger.warn('idevicesyslog not found. Install libimobiledevice for log monitoring.');
      return;
    }

    // Detached, so that it leads the process group the cleanup kills.
    this.platformProcess = spawn('idevicesyslog', ['-m', identifier], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    return this.followLogProcess(this.platformProcess, (line, stream) => {
      if (stream === 'stdout') {
        logger.info(`${EMOJI.PHONE} ${line}`);
      } else {
        logger.warn(line);
      }
    });
  }
}
