import * as path from 'path';
import type { ChildProcess } from 'child_process';
import type { Platform, PlatformCommandOptions } from '../base/index';
import { PlatformCommand } from '../base/index';
import { logger } from '../../utils/logger';
import { pathExists } from '../../utils/fs';
import { signalProcessTree } from '../../utils/exec';
import { shouldStartLocalServer } from '../../services/config.service';
import { WebServerService } from '../../services/web-server.service';
import {
  ServerStartError,
  GyoError,
  DEFAULT_PORT,
  PARENT_WATCH_INTERVAL_MS,
  PROCESS_KILL_TIMEOUT_MS,
  getErrorMessage,
} from '../../core/index';

export interface RunCommandOptions extends PlatformCommandOptions {
  profile: string;
  device?: string;
  port?: number;
}

/** Signal 0 only probes: it tells whether `pid` exists without touching it. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return (error as { code?: string }).code === 'EPERM';
  }
}

export abstract class AbstractRunCommand extends PlatformCommand<RunCommandOptions> {
  protected webServerProcess: ChildProcess | null = null;
  protected platformProcess: ChildProcess | null = null;
  protected serverUrl: string = '';
  protected isCleaningUp: boolean = false;
  private parentWatch: ReturnType<typeof setInterval> | null = null;

  protected readonly webServerService = new WebServerService();

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
        "Start command is not configured. Please set 'script.start' in gyo.config.json (e.g., 'npm run dev -- --host 0.0.0.0')"
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

  /**
   * Keeps the detected address for this run only. gyo.config.json is the
   * user's tracked file: the address is machine specific, and `gyo build`
   * resolves a `localhost` profile by itself.
   */
  protected async updateProfileUrl(profile: string, serverUrl: string): Promise<void> {
    if (!this.config) {
      return;
    }

    if (!this.config.profiles) {
      this.config.profiles = {};
    }

    if (!(profile in this.config.profiles)) {
      this.config.profiles[profile] = { serverUrl: serverUrl };
    } else {
      this.config.profiles[profile].serverUrl = serverUrl;
    }
  }

  protected async startWebServer(webPath: string, port: number): Promise<string> {
    const startCommand = this.getStartCommand();

    const handle = await this.webServerService.start({
      webPath,
      port,
      startCommand,
      preStartCleanup: this.config?.script?.preStartCleanup,
    });

    this.webServerProcess = handle.process;
    this.registerServerExitHandler();

    return handle.url;
  }

  private registerServerExitHandler(): void {
    if (!this.webServerProcess) return;

    this.webServerProcess.on('exit', (code) => {
      if (code !== 0 && !this.isCleaningUp) {
        logger.error(`\n⚠️  Web server unexpectedly stopped with code ${code}`);
        logger.error(
          'Check if another development server is running or if there are any errors above.'
        );
        logger.info('The app will continue running but may not be able to connect to the server.');
      }
    });
  }

  protected setupSignalHandlers(): void {
    const interruptCleanup = (): void => {
      if (this.isCleaningUp) {
        return;
      }
      this.isCleaningUp = true;

      if (this.parentWatch) {
        clearInterval(this.parentWatch);
        this.parentWatch = null;
      }
      this.cleanupSync();

      process.exit(0);
    };

    // Every one of these ends the CLI without running the 'exit' handlers
    // by itself: Ctrl+C, `kill`, a closed terminal, Ctrl+\. The dev server
    // leads its own process group and would outlive all of them.
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const) {
      process.on(signal, interruptCleanup);
    }

    // Exit handlers must be synchronous. This is the safety net for the paths
    // that never see a signal — an uncaught exception, an explicit exit —
    // which would otherwise leave the detached dev server and the log
    // process running.
    process.on('exit', () => this.cleanupSync());

    // The CLI is usually launched through something else: a shell, a task
    // runner, a version manager. When that launcher dies, the signal may never
    // reach this process, which then keeps the dev server and the log process
    // alive as orphans. Follow the launcher instead of waiting for a signal.
    const launcherPid = process.ppid;
    this.parentWatch = setInterval(() => {
      if (!isProcessAlive(launcherPid)) {
        interruptCleanup();
      }
    }, PARENT_WATCH_INTERVAL_MS);
    this.parentWatch.unref();
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

  /** Asks the process tree to stop, and kills it when it has not after PROCESS_KILL_TIMEOUT_MS. */
  private killProcessWithTimeout(proc: ChildProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      let exited = false;
      proc.once('exit', () => {
        exited = true;
        resolve();
      });
      signalProcessTree(proc, 'SIGTERM');

      const killTimeout = setTimeout(() => {
        if (!exited) {
          signalProcessTree(proc, 'SIGKILL');
        }
        resolve();
      }, PROCESS_KILL_TIMEOUT_MS);
      killTimeout.unref();
    });
  }

  protected cleanupSync(): void {
    if (this.webServerProcess && !this.webServerProcess.killed) {
      signalProcessTree(this.webServerProcess, 'SIGKILL');
    }

    if (this.platformProcess && !this.platformProcess.killed) {
      signalProcessTree(this.platformProcess, 'SIGKILL');
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
