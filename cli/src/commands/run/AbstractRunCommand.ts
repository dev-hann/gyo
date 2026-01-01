import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { AbstractPlatformCommand, Platform, RunCommandOptions } from '../common/AbstractPlatformCommand';
import { logger } from '../../utils/logger';
import { executeCommand, checkCommandExists } from '../../utils/exec';
import { pathExists } from '../../utils/fs';
import { saveConfig, shouldStartLocalServer } from '../../utils/config';

export abstract class AbstractRunCommand extends AbstractPlatformCommand<RunCommandOptions> {
  protected webServerProcess: ChildProcess | null = null;
  protected platformProcess: ChildProcess | null = null;
  protected serverUrl: string = '';
  protected isCleaningUp: boolean = false;

  constructor(platform: Platform, options: RunCommandOptions) {
    super(platform, options);
  }

  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  protected async run(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    
    // Check if we should start local server based on profile config
    const startLocalServer = shouldStartLocalServer(this.config, this.options.profile);
    
    if (startLocalServer) {
      // Start local development server
      const port = this.getPortFromProfile(this.options.profile);
      
      this.spinner.text = 'Starting local web server...';
      const libPath = path.join(this.projectPath, 'lib');
      this.serverUrl = await this.startWebServer(libPath, port);
      
      // Auto-update profile with actual server URL
      await this.updateProfileUrl(this.options.profile, this.serverUrl);
      
      this.spinner.succeed(`Local server running at ${this.serverUrl} (profile: ${this.options.profile})`);
    } else {
      // Use URL from config (external server)
      if (!this.config.profiles?.[this.options.profile]) {
        throw new Error(`Profile '${this.options.profile}' not found in gyo.config.json`);
      }
      
      this.serverUrl = this.config.profiles[this.options.profile].serverUrl;
      this.spinner.succeed(`Using ${this.options.profile} profile: ${this.serverUrl}`);
    }

    this.setupSignalHandlers();

    this.spinner.start(`Running ${this.platform} app...`);
    await this.runPlatform(this.serverUrl);
  }

  /**
   * Extracts port number from profile URL.
   */
  protected getPortFromProfile(profile: string): number {
    if (!this.config?.profiles?.[profile]) {
      return 3000; // Default port
    }

    const url = this.config.profiles[profile].serverUrl;
    try {
      const urlObj = new URL(url);
      const port = urlObj.port;
      return port ? parseInt(port, 10) : 3000;
    } catch (error) {
      logger.warn(`Failed to parse URL from profile '${profile}', using default port 3000`);
      return 3000;
    }
  }

  /**
   * Updates the profile with the actual server URL.
   */
  protected async updateProfileUrl(profile: string, serverUrl: string): Promise<void> {
    if (!this.config) {
      return;
    }

    // Ensure profiles object exists
    if (!this.config.profiles) {
      this.config.profiles = {};
    }

    // Ensure profile exists
    if (!this.config.profiles[profile]) {
      this.config.profiles[profile] = { serverUrl: serverUrl };
    } else {
      this.config.profiles[profile].serverUrl = serverUrl;
    }

    // Save updated config
    await saveConfig(this.config, this.projectPath);
  }

  protected async startWebServer(webPath: string, port: number): Promise<string> {
    const nodeModulesPath = path.join(webPath, 'node_modules');
    if (!(await pathExists(nodeModulesPath))) {
      this.spinner.text = 'Installing web dependencies...';
      const installResult = await executeCommand('npm', ['install'], {
        cwd: webPath,
        stdio: 'inherit'
      });

      if (!installResult.success) {
        throw new Error('Failed to install web dependencies');
      }
    }

    this.webServerProcess = spawn('npm', ['run', 'dev'], {
      cwd: webPath,
      stdio: 'pipe',
      shell: true,
      detached: true
    });

    // Wait for server to be ready by monitoring output
    const serverUrl = await this.waitForServerReady(port);
    return serverUrl;
  }

  /**
   * Waits for the development server to be ready by monitoring its output.
   * Supports multiple frameworks (Vite, Next.js, etc.)
   */
  protected async waitForServerReady(expectedPort: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Web server failed to start within 30 seconds'));
      }, 30000);

      let serverReady = false;

      // Listen to stdout for server ready messages
      this.webServerProcess?.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();

        if (serverReady) return;

        // Check for various framework ready messages and extract URL
        let detectedUrl: string | null = null;

        // Next.js patterns: "- Local:   http://localhost:3000" or "ready - started server on"
        const nextLocalMatch = output.match(/(?:Local:|started server on)\s+(?:0\.0\.0\.0|localhost|https?:\/\/(?:0\.0\.0\.0|localhost)):(\d+)/i);
        if (nextLocalMatch) {
          detectedUrl = `http://localhost:${nextLocalMatch[1]}`;
        }

        // Vite patterns: "Local:   http://localhost:5173/"
        const viteMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/i);
        if (viteMatch) {
          detectedUrl = viteMatch[1];
        }

        // Generic pattern: "http://localhost:PORT" or "http://0.0.0.0:PORT"
        if (!detectedUrl) {
          const genericMatch = output.match(/https?:\/\/(?:localhost|0\.0\.0\.0):(\d+)/i);
          if (genericMatch) {
            detectedUrl = `http://localhost:${genericMatch[1]}`;
          }
        }

        // If we found a URL, get the local IP and resolve
        if (detectedUrl) {
          serverReady = true;
          clearTimeout(timeout);

          // Extract port from detected URL
          const urlObj = new URL(detectedUrl);
          const port = parseInt(urlObj.port || '3000', 10);

          // Get local IP for mobile devices
          this.getLocalIP().then(ip => {
            resolve(`http://${ip}:${port}`);
          });
        }
      });

      // Listen to stderr as well (some frameworks output to stderr)
      this.webServerProcess?.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();

        // Some frameworks might output ready message to stderr
        if (!serverReady && output.match(/ready|listening|started/i)) {
          // Fallback: use expected port
          serverReady = true;
          clearTimeout(timeout);
          
          this.getLocalIP().then(ip => {
            resolve(`http://${ip}:${expectedPort}`);
          });
        }
      });

      // Handle process errors
      this.webServerProcess?.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start web server: ${error.message}`));
      });

      // Handle process exit
      this.webServerProcess?.on('exit', (code) => {
        if (!serverReady) {
          clearTimeout(timeout);
          reject(new Error(`Web server exited with code ${code}`));
        }
      });
    });
  }

  protected async getLocalIP(): Promise<string> {
    const os = require('os');
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
    return 'localhost';
  }

  protected setupSignalHandlers(): void {
    const cleanup = () => {
      if (this.isCleaningUp) {
        return;
      }
      this.isCleaningUp = true;
      
      // Use synchronous cleanup for signal handlers
      this.cleanupSync();
      
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
      if (!this.isCleaningUp) {
        this.cleanupSync();
      }
    });
  }

  /**
   * Async cleanup method for graceful shutdown
   */
  protected async cleanup(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Kill web server process
    if (this.webServerProcess && !this.webServerProcess.killed) {
      promises.push(new Promise<void>((resolve) => {
        this.webServerProcess!.once('exit', () => resolve());
        this.webServerProcess!.kill('SIGTERM');
        
        // Force kill after 2 seconds
        setTimeout(() => {
          if (this.webServerProcess && !this.webServerProcess.killed) {
            this.webServerProcess.kill('SIGKILL');
          }
          resolve();
        }, 2000);
      }));
    }

    // Kill platform-specific process
    if (this.platformProcess && !this.platformProcess.killed) {
      promises.push(new Promise<void>((resolve) => {
        this.platformProcess!.once('exit', () => resolve());
        this.platformProcess!.kill('SIGTERM');
        
        // Force kill after 2 seconds
        setTimeout(() => {
          if (this.platformProcess && !this.platformProcess.killed) {
            this.platformProcess.kill('SIGKILL');
          }
          resolve();
        }, 2000);
      }));
    }

    // Wait for all processes to exit
    await Promise.all(promises);
  }

  /**
   * Synchronous cleanup for exit handler
   */
  protected cleanupSync(): void {
    if (this.webServerProcess && !this.webServerProcess.killed) {
      try {
        // Kill process group for processes spawned with shell
        const pid = this.webServerProcess.pid;
        if (pid) {
          try {
            // Try to kill entire process group
            process.kill(-pid, 'SIGTERM');
          } catch (e) {
            // If process group kill fails, kill just the process
            this.webServerProcess.kill('SIGTERM');
          }
          
          // Force kill after a short delay
          setTimeout(() => {
            try {
              if (pid) {
                process.kill(-pid, 'SIGKILL');
              }
            } catch (e) {
              // Ignore
            }
          }, 100);
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    if (this.platformProcess && !this.platformProcess.killed) {
      try {
        const pid = this.platformProcess.pid;
        if (pid) {
          try {
            process.kill(-pid, 'SIGTERM');
          } catch (e) {
            this.platformProcess.kill('SIGTERM');
          }
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    return checkCommandExists(command);
  }

  protected abstract runPlatform(serverUrl: string): Promise<void>;

  protected async handleError(error: unknown): Promise<void> {
    this.spinner.fail('Run failed');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }

    await this.cleanup();

    process.exit(1);
  }
}
