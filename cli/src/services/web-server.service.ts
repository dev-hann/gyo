import * as path from 'path';
import os from 'os';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import { logger } from '../utils/logger';
import { executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import {
  ServerStartError,
  getErrorMessage,
  WEB_SERVER_TIMEOUT_MS,
  LOCALHOST,
  DEFAULT_PORT,
} from '../core/index';

export interface StartServerOptions {
  webPath: string;
  port: number;
  startCommand: string;
}

export interface ServerHandle {
  process: ChildProcess;
  url: string;
}

export class WebServerService {
  async start(options: StartServerOptions): Promise<ServerHandle> {
    const { webPath, port, startCommand } = options;

    await this.ensureNodeModules(webPath);
    await this.removeNextLockFile(webPath);

    const isVite = /\bvite\b/.test(startCommand);
    const finalCommand = isVite ? `${startCommand} -- --host 0.0.0.0` : startCommand;

    const serverProcess = spawn(finalCommand, [], {
      cwd: webPath,
      stdio: 'pipe',
      shell: true,
      detached: true,
    });

    const url = await this.waitForServerReady(serverProcess, port);

    return { process: serverProcess, url };
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

  private async removeNextLockFile(webPath: string): Promise<void> {
    const lockFile = path.join(webPath, '.next/dev/lock');
    if (await pathExists(lockFile)) {
      try {
        await fs.remove(lockFile);
      } catch (error) {
        logger.warn(`Could not remove lock file: ${getErrorMessage(error)}`);
      }
    }
  }

  private async waitForServerReady(
    serverProcess: ChildProcess,
    expectedPort: number
  ): Promise<string> {
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
        if (onStdoutData) serverProcess.stdout?.off('data', onStdoutData);
        if (onStderrData) serverProcess.stderr?.off('data', onStderrData);
        if (onError) serverProcess.off('error', onError);
        if (onExit) serverProcess.off('exit', onExit);
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
        }
      };

      serverProcess.stdout?.on('data', onStdoutData);
      serverProcess.stderr?.on('data', onStderrData);
      serverProcess.on('error', onError);
      serverProcess.on('exit', onExit);
    });
  }

  extractServerUrl(output: string): string | null {
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

  async resolveServerUrl(detectedUrl: string): Promise<string> {
    const urlObj = new URL(detectedUrl);
    const port = parseInt(urlObj.port || String(DEFAULT_PORT), 10);

    try {
      const ip = await this.getLocalIP();
      return `http://${ip}:${port}`;
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
