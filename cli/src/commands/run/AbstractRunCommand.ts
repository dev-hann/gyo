import * as path from 'path';
import os from 'os';
import { ChildProcess, spawn } from 'child_process';
import { PlatformCommand, Platform, PlatformCommandOptions } from '../base/index';
import { logger } from '../../utils/logger';
import { executeCommand, checkCommandExists } from '../../utils/exec';
import { pathExists } from '../../utils/fs';
import { saveConfig, shouldStartLocalServer } from '../../services/config.service';
import {
  ServerStartError,
  GyoError,
  DEFAULT_PORT,
  WEB_SERVER_TIMEOUT_MS,
  PROCESS_KILL_TIMEOUT_MS,
  LOCALHOST,
} from '../../core/index';

export interface RunCommandOptions extends PlatformCommandOptions {
  profile: string;
  device?: string;
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
    if (this.platformProcess && !this.platformProcess.killed) {
      try {
        const pid = this.platformProcess.pid;
        if (pid) {
          this.platformProcess.kill('SIGTERM');
        }
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  protected async run(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    this.setupSignalHandlers();

    const startLocalServer = shouldStartLocalServer(this.config, this.options.profile);

    if (startLocalServer) {
      try {
        const port = this.getPortFromProfile(this.options.profile);

        this.updateSpinner('Starting local web server...');
        const libPath = path.join(this.projectPath, 'lib');

        this.serverUrl = await this.startWebServer(libPath, port);

        await this.updateProfileUrl(this.options.profile, this.serverUrl);

        this.succeedSpinner(
          `Local server running at ${this.serverUrl} (profile: ${this.options.profile})`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.failSpinner(`Failed to start web server: ${errorMsg}`);
        await this.cleanup();
        throw error;
      }
    } else {
      if (!this.config.profiles?.[this.options.profile]) {
        throw new Error(`Profile '${this.options.profile}' not found in gyo.config.json`);
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
      throw new Error(
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
    } catch {
      logger.warn(
        `Failed to parse URL from profile '${profile}', using default port ${DEFAULT_PORT}`
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
      this.updateSpinner('Installing web dependencies...');
      const installResult = await executeCommand('npm', ['install'], {
        cwd: webPath,
        stdio: 'inherit',
      });

      if (!installResult.success) {
        throw new ServerStartError('Failed to install web dependencies');
      }
    }

    const lockFile = path.join(webPath, '.next/dev/lock');
    if (await pathExists(lockFile)) {
      try {
        const fs = await import('fs-extra');
        await fs.remove(lockFile);
      } catch (error) {
        logger.warn(`Could not remove lock file: ${error}`);
      }
    }

    const startCommand = this.getStartCommand();
    this.webServerProcess = spawn(startCommand, [], {
      cwd: webPath,
      stdio: 'pipe',
      shell: true,
      detached: true,
    });

    const serverUrl = await this.waitForServerReady(port);
    return serverUrl;
  }

  protected async waitForServerReady(expectedPort: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Web server failed to start within ${WEB_SERVER_TIMEOUT_MS / 1000} seconds`)
        );
      }, WEB_SERVER_TIMEOUT_MS);

      let serverReady = false;

      this.webServerProcess?.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();

        if (serverReady) return;

        let detectedUrl: string | null = null;

        const nextLocalMatch = output.match(
          /(?:Local:|started server on)\s+(?:0\.0\.0\.0|localhost|https?:\/\/(?:0\.0\.0\.0|localhost)):(\d+)/i
        );
        if (nextLocalMatch) {
          detectedUrl = `http://${LOCALHOST}:${nextLocalMatch[1]}`;
        }

        const viteMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/i);
        if (viteMatch) {
          detectedUrl = viteMatch[1];
        }

        if (!detectedUrl) {
          const genericMatch = output.match(/https?:\/\/(?:localhost|0\.0\.0\.0):(\d+)/i);
          if (genericMatch) {
            detectedUrl = `http://${LOCALHOST}:${genericMatch[1]}`;
          }
        }

        if (detectedUrl) {
          serverReady = true;
          clearTimeout(timeout);

          const urlObj = new URL(detectedUrl);
          const port = parseInt(urlObj.port || String(DEFAULT_PORT), 10);

          this.getLocalIP().then((ip) => {
            resolve(`http://${ip}:${port}`);
          });
        }
      });

      this.webServerProcess?.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();

        if (!serverReady && output.match(/ready|listening|started/i)) {
          serverReady = true;
          clearTimeout(timeout);

          this.getLocalIP().then((ip) => {
            resolve(`http://${ip}:${expectedPort}`);
          });
        }
      });

      this.webServerProcess?.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start web server: ${error.message}`));
      });

      this.webServerProcess?.on('exit', (code) => {
        if (!serverReady) {
          clearTimeout(timeout);
          reject(new Error(`Web server exited with code ${code}`));
        } else if (code !== 0 && !this.isCleaningUp) {
          logger.error(`\n⚠️  Web server unexpectedly stopped with code ${code}`);
          logger.error(
            'Check if another development server is running or if there are any errors above.'
          );
          logger.info(
            'The app will continue running but may not be able to connect to the server.'
          );
        }
      });
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
      promises.push(
        new Promise<void>((resolve) => {
          this.webServerProcess!.once('exit', () => resolve());
          this.webServerProcess!.kill('SIGTERM');

          setTimeout(() => {
            if (this.webServerProcess && !this.webServerProcess.killed) {
              this.webServerProcess.kill('SIGKILL');
            }
            resolve();
          }, PROCESS_KILL_TIMEOUT_MS);
        })
      );
    }

    if (this.platformProcess && !this.platformProcess.killed) {
      promises.push(
        new Promise<void>((resolve) => {
          this.platformProcess!.once('exit', () => resolve());
          this.platformProcess!.kill('SIGTERM');

          setTimeout(() => {
            if (this.platformProcess && !this.platformProcess.killed) {
              this.platformProcess.kill('SIGKILL');
            }
            resolve();
          }, PROCESS_KILL_TIMEOUT_MS);
        })
      );
    }

    await Promise.all(promises);
  }

  protected cleanupSync(): void {
    if (this.webServerProcess && !this.webServerProcess.killed) {
      try {
        const pid = this.webServerProcess.pid;
        if (pid) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            try {
              this.webServerProcess.kill('SIGKILL');
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore errors during cleanup
      }
    }

    if (this.platformProcess && !this.platformProcess.killed) {
      try {
        const pid = this.platformProcess.pid;
        if (pid) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            try {
              this.platformProcess.kill('SIGKILL');
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    return checkCommandExists(command);
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

      this.platformProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            console.log(`📱 ${line.trim()}`);
          }
        }
      });

      this.platformProcess.stderr?.on('data', () => {});

      this.platformProcess.on('exit', (code) => {
        if (!this.isCleaningUp && code !== 0) {
          logger.warn('Log monitoring stopped');
        }
        resolve();
      });

      this.platformProcess.on('error', (error) => {
        if (!this.isCleaningUp) {
          reject(error);
        }
      });
    });
  }

  protected async handleError(error: unknown): Promise<void> {
    this.failSpinner('Run failed');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }

    await this.cleanup();

    if (error instanceof GyoError) {
      throw error;
    }
    throw new GyoError(error instanceof Error ? error.message : String(error), 1, {
      cause: error,
    });
  }
}
