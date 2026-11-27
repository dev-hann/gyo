import * as path from 'path';
import * as net from 'net';
import * as os from 'os';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import { logger } from '../utils/logger';
import { executeCommand, signalProcessTree } from '../utils/exec';
import { pathExists } from '../utils/fs';
import {
  ServerStartError,
  getErrorMessage,
  WEB_SERVER_TIMEOUT_MS,
  PROBE_INTERVAL_MS,
  LOCALHOST,
  DEFAULT_PORT,
  isLoopbackHost,
} from '../core/index';

export interface StartServerOptions {
  webPath: string;
  port: number;
  startCommand: string;
  preStartCleanup?: string[];
  /** The address devices should load the server from; the LAN address when not given. */
  advertiseHost?: string;
}

export interface ServerHandle {
  process: ChildProcess;
  url: string;
}

export const REACHABLE_TIMEOUT_MS = 2000;

export class WebServerService {
  async start(options: StartServerOptions): Promise<ServerHandle> {
    const { webPath, port, startCommand, preStartCleanup, advertiseHost } = options;

    await this.ensureNodeModules(webPath);
    await this.cleanupPaths(webPath, preStartCleanup ?? []);

    // A server already listening here would satisfy the readiness probe, so
    // the one just spawned could die unnoticed while its output is taken
    // for a successful start.
    if (await this.isPortOpen(port)) {
      throw new ServerStartError(
        `Port ${port} is already in use. Stop the server on it, or give the profile a serverUrl with a free port.`
      );
    }

    const serverProcess = spawn(startCommand, [], {
      cwd: webPath,
      stdio: 'pipe',
      shell: true,
      detached: true,
    });

    try {
      const localUrl = await this.waitForServerReady(serverProcess, port);
      const url = await this.resolveServerUrl(localUrl, advertiseHost);
      await this.requireReachable(url);
      return { process: serverProcess, url };
    } catch (error) {
      // The caller never receives the process, so nothing else would stop
      // what it started.
      signalProcessTree(serverProcess, 'SIGKILL');
      throw error;
    }
  }

  /**
   * The server answered on localhost; a device loads it at `url`. One that
   * listens on localhost only leaves the app unable to connect, with
   * nothing on the developer's machine to say so.
   */
  private requireReachable(url: string): Promise<void> {
    const { hostname, port } = new URL(url);
    const host = hostname.replace(/^\[(.*)\]$/, '$1');
    if (isLoopbackHost(host)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(
          new ServerStartError(
            `The dev server is running, but it does not answer at ${url}, where the device will look for it.\n` +
              '  If it listens on localhost only, start it on every interface and put that command in script.start,\n' +
              '  for example "npm run dev -- --host 0.0.0.0". If it already does, name the address to use in the profile\'s serverUrl.'
          )
        );
      };

      const socket = net.connect({ host, port: Number(port) });
      const timer = setTimeout(() => {
        socket.destroy();
        fail();
      }, REACHABLE_TIMEOUT_MS);
      timer.unref();
      socket.once('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        settled = true;
        resolve();
      });
      socket.once('error', () => {
        clearTimeout(timer);
        socket.destroy();
        fail();
      });
    });
  }

  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect({ host: LOCALHOST, port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private async ensureNodeModules(webPath: string): Promise<void> {
    const nodeModulesPath = path.join(webPath, 'node_modules');
    if (!(await pathExists(nodeModulesPath))) {
      logger.info('node_modules not found. Installing dependencies (this may take a minute)...');
      const installResult = await executeCommand('npm', ['install'], {
        cwd: webPath,
        stdio: 'inherit',
      });

      if (!installResult.success) {
        throw new ServerStartError('Failed to install web dependencies');
      }
    }
  }

  private async cleanupPaths(webPath: string, relativePaths: string[]): Promise<void> {
    for (const relativePath of relativePaths) {
      const target = path.join(webPath, relativePath);
      if (await pathExists(target)) {
        try {
          await fs.remove(target);
          logger.debug(`Removed stale file before server start: ${target}`);
        } catch (error) {
          logger.warn(`Could not remove ${relativePath}: ${getErrorMessage(error)}`);
        }
      }
    }
  }

  private async waitForServerReady(
    serverProcess: ChildProcess,
    expectedPort: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        doReject(
          new Error(`Web server failed to start within ${WEB_SERVER_TIMEOUT_MS / 1000} seconds`)
        );
      }, WEB_SERVER_TIMEOUT_MS);
      timeout.unref();

      let settled = false;
      let probeTimer: ReturnType<typeof setTimeout> | null = null;
      let probeSocket: net.Socket | null = null;

      const clearProbe = (): void => {
        if (probeTimer) clearTimeout(probeTimer);
        probeSocket?.destroy();
      };

      const doResolve = (url: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearProbe();
        detachProcessListeners();
        resolve(url);
      };

      const doReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearProbe();
        detachProcessListeners();
        reject(error);
      };

      const onError = (error: Error): void => {
        doReject(new Error(`Failed to start web server: ${error.message}`));
      };

      const onExit = (code: number | null): void => {
        doReject(new Error(`Web server exited with code ${code}`));
      };

      const detachProcessListeners = (): void => {
        serverProcess.off('error', onError);
        serverProcess.off('exit', onExit);
      };

      // Surface server errors from output (port in use, permission, ...)
      serverProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.match(/error|EADDRINUSE|EACCES/i)) {
          logger.error(`[web server] ${output.trim()}`);
        }
      });

      serverProcess.on('error', onError);
      serverProcess.on('exit', onExit);

      // Framework-agnostic readiness detection: poll the expected port
      // until it accepts TCP connections.
      const attemptProbe = (): void => {
        if (settled) return;

        probeSocket = net.connect({ host: LOCALHOST, port: expectedPort });
        probeSocket.once('connect', () => {
          probeSocket?.destroy();
          this.resolveServerUrl(`http://${LOCALHOST}:${expectedPort}`)
            .then(doResolve)
            .catch(doReject);
        });
        probeSocket.once('error', () => {
          probeSocket?.destroy();
          if (!settled) {
            probeTimer = setTimeout(attemptProbe, PROBE_INTERVAL_MS);
          }
        });
      };

      attemptProbe();
    });
  }

  /** The URL devices load: the given host, or this machine's address on the LAN. */
  async resolveServerUrl(detectedUrl: string, advertiseHost?: string): Promise<string> {
    const urlObj = new URL(detectedUrl);
    const port = parseInt(urlObj.port || String(DEFAULT_PORT), 10);

    try {
      return `http://${advertiseHost ?? (await this.getLocalIP())}:${port}`;
    } catch (error) {
      logger.warn(`Failed to get local IP, using localhost: ${getErrorMessage(error)}`);
      return `http://${LOCALHOST}:${port}`;
    }
  }

  async getLocalIP(): Promise<string> {
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
}
