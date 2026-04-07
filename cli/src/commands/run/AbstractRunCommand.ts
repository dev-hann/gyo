import * as path from 'path';
import os from 'os';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs-extra';
import { PlatformCommand, Platform, PlatformCommandOptions } from '../base/index';
import { logger } from '../../utils/logger';
import { executeCommand } from '../../utils/exec';
import { pathExists } from '../../utils/fs';
import { saveConfig, shouldStartLocalServer } from '../../services/config.service';
import {
  ServerStartError,
  GyoError,
  DEFAULT_PORT,
  WEB_SERVER_TIMEOUT_MS,
  PROCESS_KILL_TIMEOUT_MS,
  LOCALHOST,
  getErrorMessage,
} from '../../core/index';

export interface RunCommandOptions extends PlatformCommandOptions {
  profile: string;
  device?: string;
  port?: number;
}

export abstract class AbstractRunCommand extends PlatformCommand<RunCommandOptions> {
  protected webServerProcess: ChildProcess | null = null;
  protected platformProcess: ChildProcess | null = null;
  protected serverUrl: string = '';
  protected isCleaningUp: boolean = false;

  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  protected cleanupPlatformOnly(): void {
    if (!this.platformProcess || this.platformProcess.killed) {
      return;
    }

    try {
      const pid = this.platformProcess.pid;
      if (typeof pid === 'number' && pid > 0) {
        this.platformProcess.kill('SIGTERM');
      }
    } catch (e) {
      logger.debug(`Failed to kill platform process: ${getErrorMessage(e)}`);
    }
  }

  protected async run(): Promise<void> {
    if (!this.config) {
      throw new GyoError('Config not loaded');
    }

    this.setupSignalHandlers();

    const startLocalServer = shouldStartLocalServer(this.options.profile);
    const libPath = path.join(this.projectPath, 'lib');

    if (startLocalServer) {
      await this.validateLibDirectory(libPath);

      try {
        const port = this.options.port ?? this.getPortFromProfile(this.options.profile);

        this.updateSpinner('Starting local web server...');

        this.serverUrl = await this.startWebServer(libPath, port);

        await this.updateProfileUrl(this.options.profile, this.serverUrl);

        this.succeedSpinner(
          `Local server running at ${this.serverUrl} (profile: ${this.options.profile})`
        );
      } catch (error) {
        const errorMsg = getErrorMessage(error);
        this.failSpinner(`Failed to start web server: ${errorMsg}`);
        await this.cleanup();
        throw error;
      }
    } else {
      if (!this.config.profiles?.[this.options.profile]) {
        const available = this.config.profiles ? Object.keys(this.config.profiles) : [];
        const availableText =
          available.length > 0
            ? `Available profiles: ${available.join(', ')}`
            : 'No profiles configured';
        throw new GyoError(
          `Profile '${this.options.profile}' not found in gyo.config.json. ${availableText}`
        );
      }

      this.serverUrl = this.config.profiles[this.options.profile].serverUrl;
      this.succeedSpinner(`Using ${this.options.profile} profile: ${this.serverUrl}`);
    }

    this.startSpinner(`Running ${this.platform} app...`);

    try {
      await this.runPlatform(this.serverUrl);
    } finally {
      this.cleanupPlatformOnly();
    }
  }

  protected getStartCommand(): string {
    const command = this.config?.script?.start;

    if (!command || command.trim() === '') {
      throw new ServerStartError(
        "Start command is not configured. Please set 'script.start' in gyo.config.json (e.g., 'npm run dev' for Vite/Next.js)"
      );
    }

    return command.trim();
  }

  protected getPortFromProfile(profile: string): number {
    if (!this.config?.profiles?.[profile]) {
      return DEFAULT_PORT;
    }

    const url = this.config.profiles[profile].serverUrl;
    try {
      const urlObj = new URL(url);
      const port = urlObj.port;
      return port ? parseInt(port, 10) : DEFAULT_PORT;
    } catch (error) {
      const message = getErrorMessage(error);
      logger.warn(
        `Failed to parse URL from profile '${profile}', using default port ${DEFAULT_PORT}: ${message}`
      );
      return DEFAULT_PORT;
    }
  }

  protected async updateProfileUrl(profile: string, serverUrl: string): Promise<void> {
    if (!this.config) {
      return;
    }

    if (!this.config.profiles) {
      this.config.profiles = {};
    }

    if (!this.config.profiles[profile]) {
      this.config.profiles[profile] = { serverUrl: serverUrl };
    } else {
      this.config.profiles[profile].serverUrl = serverUrl;
    }

    await saveConfig(this.config, this.projectPath);
  }

  protected async startWebServer(webPath: string, port: number): Promise<string> {
    const nodeModulesPath = path.join(webPath, 'node_modules');
    if (!(await pathExists(nodeModulesPath))) {
      this.stopSpinner();
      logger.info('node_modules not found. Installing dependencies (this may take a minute)...');
      const installResult = await executeCommand('npm', ['install'], {
        cwd: webPath,
        stdio: 'inherit',
      });

      if (!installResult.success) {
        throw new ServerStartError('Failed to install web dependencies');
      }
      this.startSpinner('Starting web server...');
    }

    const lockFile = path.join(webPath, '.next/dev/lock');
    if (await pathExists(lockFile)) {
      try {
        await fs.remove(lockFile);
      } catch (error) {
        logger.warn(`Could not remove lock file: ${getErrorMessage(error)}`);
      }
    }

    const startCommand = this.getStartCommand();
    const isVite = /\bvite\b/.test(startCommand);
    const finalCommand = isVite ? `${startCommand} -- --host 0.0.0.0` : startCommand;

    this.webServerProcess = spawn(finalCommand, [], {
      cwd: webPath,
      stdio: 'pipe',
      shell: true,
      detached: true,
    });

    const serverUrl = await this.waitForServerReady(port);
    return serverUrl;
  }

  private extractServerUrl(output: string): string | null {
    const nextLocalMatch = output.match(
      /(?:Local:|started server on)\s+(?:0\.0\.0\.0|localhost|https?:\/\/(?:0\.0\.0\.0|localhost)):(\d+)/i
    );
    if (nextLocalMatch) {
      return `http://${LOCALHOST}:${nextLocalMatch[1]}`;
    }

    const viteMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/i);
    if (viteMatch) {
      return viteMatch[1];
    }

    const genericMatch = output.match(/https?:\/\/(?:localhost|0\.0\.0\.0):(\d+)/i);
    if (genericMatch) {
      return `http://${LOCALHOST}:${genericMatch[1]}`;
    }

    return null;
  }

  private resolveServerUrl(detectedUrl: string): Promise<string> {
    const urlObj = new URL(detectedUrl);
    const port = parseInt(urlObj.port || String(DEFAULT_PORT), 10);

    return this.getLocalIP()
      .then((ip) => {
        return `http://${ip}:${port}`;
      })
      .catch((error) => {
        logger.warn(`Failed to get local IP, using localhost: ${getErrorMessage(error)}`);
        return `http://${LOCALHOST}:${port}`;
      });
  }

  protected async waitForServerReady(expectedPort: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Web server failed to start within ${WEB_SERVER_TIMEOUT_MS / 1000} seconds`)
        );
      }, WEB_SERVER_TIMEOUT_MS);
      timeout.unref();

      let serverReady = false;
      let resolved = false;

      const doResolve = (url: string): void => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        removeListeners();
        resolve(url);
      };

      const doReject = (error: Error): void => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        removeListeners();
        reject(error);
      };

      let onStdoutData: ((data: Buffer) => void) | null = null;
      let onStderrData: ((data: Buffer) => void) | null = null;
      let onError: ((error: Error) => void) | null = null;
      let onExit: ((code: number | null) => void) | null = null;

      const removeListeners = (): void => {
        if (onStdoutData) {
          this.webServerProcess?.stdout?.off('data', onStdoutData);
        }
        if (onStderrData) {
          this.webServerProcess?.stderr?.off('data', onStderrData);
        }
        if (onError) {
          this.webServerProcess?.off('error', onError);
        }
        if (onExit) {
          this.webServerProcess?.off('exit', onExit);
        }
      };

      onStdoutData = (data: Buffer): void => {
        if (serverReady) return;
        const output = data.toString();
        const detectedUrl = this.extractServerUrl(output);
        if (detectedUrl) {
          serverReady = true;
          this.resolveServerUrl(detectedUrl).then(doResolve).catch(doReject);
        }
      };

      onStderrData = (data: Buffer): void => {
        const output = data.toString();
        if (output.match(/error|EADDRINUSE|EACCES/i)) {
          logger.error(`[web server] ${output.trim()}`);
        }
        if (!serverReady && output.match(/ready|listening|started/i)) {
          serverReady = true;
          this.resolveServerUrl(`http://${LOCALHOST}:${expectedPort}`)
            .then(doResolve)
            .catch(doReject);
        }
      };

      onError = (error: Error): void => {
        doReject(new Error(`Failed to start web server: ${error.message}`));
      };

      onExit = (code: number | null): void => {
        if (!serverReady) {
          doReject(new Error(`Web server exited with code ${code}`));
        } else if (code !== 0 && !this.isCleaningUp) {
          logger.error(`\n⚠️  Web server unexpectedly stopped with code ${code}`);
          logger.error(
            'Check if another development server is running or if there are any errors above.'
          );
          logger.info(
            'The app will continue running but may not be able to connect to the server.'
          );
        }
      };

      this.webServerProcess?.stdout?.on('data', onStdoutData);
      this.webServerProcess?.stderr?.on('data', onStderrData);
      this.webServerProcess?.on('error', onError);
      this.webServerProcess?.on('exit', onExit);
    });
  }

  protected async getLocalIP(): Promise<string> {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            return alias.address;
          }
        }
      }
    }
    return LOCALHOST;
  }

  protected setupSignalHandlers(): void {
    const interruptCleanup = (): void => {
      if (this.isCleaningUp) {
        return;
      }
      this.isCleaningUp = true;

      this.cleanupSync();

      process.exit(0);
    };

    process.on('SIGINT', interruptCleanup);
    process.on('SIGTERM', interruptCleanup);
  }

  protected async cleanup(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.webServerProcess && !this.webServerProcess.killed) {
      promises.push(this.killProcessWithTimeout(this.webServerProcess));
    }

    if (this.platformProcess && !this.platformProcess.killed) {
      promises.push(this.killProcessWithTimeout(this.platformProcess));
    }

    await Promise.all(promises);
  }

  private killProcessWithTimeout(proc: ChildProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      proc.once('exit', () => resolve());
      proc.kill('SIGTERM');

      const killTimeout = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
        resolve();
      }, PROCESS_KILL_TIMEOUT_MS);
      killTimeout.unref();
    });
  }

  private killProcessSync(proc: ChildProcess, name: string): void {
    const pid = proc.pid;
    if (!pid) {
      return;
    }

      const killProcess = (killFn: () => void, description: string): boolean => {
      try {
        killFn();
        return true;
      } catch (e) {
        logger.debug(`Failed to ${description} ${name} process: ${getErrorMessage(e)}`);
        return false;
      }
    };

    if (!killProcess(() => process.kill(-pid, 'SIGKILL'), 'kill process group by PID')) {
      killProcess(() => proc.kill('SIGKILL'), 'kill process');
    }
  }

  protected cleanupSync(): void {
    if (this.webServerProcess && !this.webServerProcess.killed) {
      this.killProcessSync(this.webServerProcess, 'web server');
    }

    if (this.platformProcess && !this.platformProcess.killed) {
      this.killProcessSync(this.platformProcess, 'platform');
    }
  }

  private async validateLibDirectory(libPath: string): Promise<void> {
    if (!(await pathExists(libPath))) {
      throw new ServerStartError(
        `'lib/' directory not found in ${this.projectPath}.\n  Run 'gyo create <project-name>' to scaffold a project, or check you're in the correct directory.`
      );
    }

    const pkgPath = path.join(libPath, 'package.json');
    if (!(await pathExists(pkgPath))) {
      throw new ServerStartError(
        `'lib/package.json' not found.\n  Run 'gyo create <project-name>' to scaffold a project, or set up a web application in the lib/ directory.`
      );
    }
  }

  protected abstract runPlatform(serverUrl: string): Promise<void>;

  protected showSuccessMessage(serverUrl: string): void {
    logger.log('');
    logger.success(`App is connected to: ${serverUrl}`);
    logger.info('Monitoring console logs (Press Ctrl+C to stop)...');
    logger.log('');
  }

  protected async monitorLogs(_identifier: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.platformProcess) {
        resolve();
        return;
      }

      const logLine = (line: string, logFn: (msg: string) => void): void => {
        const trimmed = line.trim();
        if (trimmed) {
          logFn(trimmed);
        }
      };

      this.platformProcess.stdout?.on('data', (data: Buffer) => {
        data
          .toString()
          .split('\n')
          .forEach((line) => logLine(line, logger.info));
      });

      this.platformProcess.stderr?.on('data', (data: Buffer) => {
        data
          .toString()
          .split('\n')
          .forEach((line) => logLine(line, logger.warn));
      });

      this.platformProcess.on('exit', (code) => {
        if (!this.isCleaningUp && code !== 0) {
          logger.warn('Log monitoring stopped');
        }
        resolve();
      });

      this.platformProcess.on('error', (error) => {
        if (!this.isCleaningUp) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  protected async handleError(error: unknown): Promise<void> {
    this.failSpinner('Run failed');
    logger.error(getErrorMessage(error));
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }

    await this.cleanup();

    if (error instanceof GyoError) {
      throw error;
    }
    throw new GyoError(getErrorMessage(error), 1, {
      cause: error,
    });
  }
}
