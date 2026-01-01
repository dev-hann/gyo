import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { AbstractPlatformCommand, Platform, CommandOptions } from '../common/AbstractPlatformCommand';
import { logger } from '../../utils/logger';
import { executeCommand, checkCommandExists } from '../../utils/exec';
import { pathExists } from '../../utils/fs';
import { saveConfig } from '../../utils/config';

export abstract class AbstractRunCommand extends AbstractPlatformCommand {
  protected webServerProcess: ChildProcess | null = null;
  protected serverUrl: string = '';

  constructor(platform: Platform, options: CommandOptions = {}) {
    super(platform, options);
  }

  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  protected async run(): Promise<void> {
    const profile = this.options.profile || 'development';
    
    // Extract port from profile URL
    const port = this.getPortFromProfile(profile);
    
    this.spinner.text = 'Starting web development server...';
    const libPath = path.join(this.projectPath, 'lib');
    this.serverUrl = await this.startWebServer(libPath, port);
    
    // Auto-update development profile with actual server URL
    if (profile === 'development') {
      await this.updateDevelopmentProfile(this.serverUrl);
    }
    
    this.spinner.succeed(`Web server running at ${this.serverUrl} (profile: ${profile})`);

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

    const url = this.config.profiles[profile].webviewUrl;
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
   * Updates the development profile with the actual server URL.
   */
  protected async updateDevelopmentProfile(serverUrl: string): Promise<void> {
    if (!this.config) {
      return;
    }

    // Ensure profiles object exists
    if (!this.config.profiles) {
      this.config.profiles = {};
    }

    // Ensure development profile exists
    if (!this.config.profiles.development) {
      this.config.profiles.development = { webviewUrl: serverUrl };
    } else {
      this.config.profiles.development.webviewUrl = serverUrl;
    }

    // Save updated config
    await saveConfig(this.config, this.projectPath);
  }

  protected async startWebServer(webPath: string, port: number): Promise<string> {
    const nodeModulesPath = path.join(webPath, 'node_modules');
    if (!(await pathExists(nodeModulesPath))) {
      logger.info('Installing web dependencies...');
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
      detached: false
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const ip = await this.getLocalIP();
    return `http://${ip}:${port}`;
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
    process.on('SIGINT', () => {
      logger.info('\nStopping web server...');
      if (this.webServerProcess) {
        this.webServerProcess.kill();
      }
      process.exit(0);
    });
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    return checkCommandExists(command);
  }

  protected abstract runPlatform(serverUrl: string): Promise<void>;

  protected handleError(error: unknown): void {
    this.spinner.fail('Run failed');
    logger.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }

    if (this.webServerProcess) {
      this.webServerProcess.kill();
    }

    process.exit(1);
  }
}
