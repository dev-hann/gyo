import * as path from 'path';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import { AbstractRunCommand } from './AbstractRunCommand.ts';
import { logger } from '../../utils/logger.ts';
import { executeCommand } from '../../utils/exec.ts';
import { pathExists, readFile, writeFile } from '../../utils/fs.ts';

export class IOSRunCommand extends AbstractRunCommand {
  protected async runPlatform(serverUrl: string): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    await this.checkPlatformExists('ios');
    await this.checkXtoolAvailable();
    await this.updateServerUrl(iosPath, serverUrl);

    let bundleId = await this.getBundleId(iosPath);
    if (!bundleId) {
      this.spinner.fail('Could not read bundle ID from xtool.yml');
      process.exit(1);
    }

    bundleId = await this.buildAndInstallApp(iosPath, bundleId);

    this.showSuccessMessage(serverUrl);
    await this.monitorLogs(bundleId);
  }

  private async checkXtoolAvailable(): Promise<void> {
    if (!(await this.checkCommandExists('xtool'))) {
      this.spinner.fail('xtool not found');
      logger.error('Install xtool: https://xtool.sh');
      process.exit(1);
    }
  }

  private async updateServerUrl(iosPath: string, serverUrl: string): Promise<void> {
    this.spinner.text = `Updating server URL to ${serverUrl}...`;
    const resourcesPath = path.join(iosPath, 'Sources/Resources');
    const configPath = path.join(resourcesPath, 'gyo-config.json');

    await fs.ensureDir(resourcesPath);

    const config = {
      serverUrl: serverUrl
    };

    const configJson = JSON.stringify(config, null, 2);
    await writeFile(configPath, configJson);
    
    // Clean build cache to ensure new config is used
    const buildPath = path.join(iosPath, '.build');
    if (await pathExists(buildPath)) {
      logger.verbose('Cleaning build cache...');
      await fs.remove(buildPath);
    }
    
    logger.verbose(`Wrote config to ${configPath}: ${configJson}`);
  }

  private async getBundleId(iosPath: string): Promise<string | null> {
    try {
      const xtoolYmlPath = path.join(iosPath, 'xtool.yml');
      if (!(await pathExists(xtoolYmlPath))) {
        logger.error('xtool.yml not found in ios directory');
        return null;
      }

      const content = await readFile(xtoolYmlPath);
      
      // Check if bundleID is properly formatted (should be a scalar value, not a mapping)
      if (content.includes('bundleID:') && content.match(/bundleID:\s*\n\s+/)) {
        logger.error('Invalid xtool.yml: bundleID should be a string value, not a mapping');
        logger.error('Expected format: bundleID: com.example.app');
        logger.error(`Check your xtool.yml file at: ${xtoolYmlPath}`);
        return null;
      }
      
      const match = content.match(/bundleID:\s*(.+)/);
      if (!match) {
        logger.error('bundleID not found in xtool.yml');
        logger.error(`Check your xtool.yml file at: ${xtoolYmlPath}`);
        return null;
      }
      
      const bundleId = match[1].trim();
      if (bundleId.startsWith('{{') || bundleId.includes('{{')) {
        logger.error(`bundleID contains template variable: ${bundleId}`);
        logger.error('Template variables should have been replaced during project creation');
        logger.error(`Check your xtool.yml file at: ${xtoolYmlPath}`);
        return null;
      }
      
      return bundleId;
    } catch (error) {
      logger.error(`Failed to read xtool.yml: ${error}`);
      return null;
    }
  }

  private async buildAndInstallApp(iosPath: string, bundleId: string): Promise<string> {
    this.spinner.text = 'Building and installing iOS app...';

    const buildResult = await executeCommand('xtool', ['dev'], {
      cwd: iosPath,
      stdio: 'pipe'
    });

    if (!buildResult.success) {
      this.spinner.fail('Build failed');
      const errorOutput = buildResult.stderr || buildResult.stdout || 'Unknown error';
      
      // Check for common YAML parsing errors
      if (errorOutput.includes('typeMismatch') || errorOutput.includes('Expected to decode Scalar')) {
        logger.error('YAML parsing error in xtool.yml or project.yml');
        logger.error('Common issues:');
        logger.error('  1. bundleID should be a simple string value, not a mapping');
        logger.error('     ✓ Correct:   bundleID: com.example.app');
        logger.error('     ✗ Wrong:     bundleID:');
        logger.error('                    key: value');
        logger.error('  2. Check for unintended indentation or special characters');
        logger.error(`\nFull error:\n${errorOutput}`);
      } else {
        logger.error(errorOutput);
      }
      process.exit(1);
    }

    this.spinner.text = 'Finding installed app...';

    let fullBundleId = bundleId;
    const combinedOutput = (buildResult.stdout || '') + (buildResult.stderr || '');

    let match = combinedOutput.match(/bundleIDs\s*=\s*\(\s*"([^"]+)"/);
    if (match && match[1].includes(bundleId.split('.').pop() || '')) {
      fullBundleId = match[1];
    }

    if (fullBundleId === bundleId) {
      match = combinedOutput.match(/(XTL-[A-Z0-9]+\.[a-z0-9.]+)/i);
      if (match && match[1].toLowerCase().includes(bundleId.split('.').pop()?.toLowerCase() || '')) {
        fullBundleId = match[1];
      }
    }

    if (fullBundleId === bundleId && await this.checkCommandExists('idevicesyslog')) {
      fullBundleId = await this.findBundleIdFromSyslog(bundleId);
    }

    if (fullBundleId !== bundleId) {
      logger.info(`Found full bundle ID: ${fullBundleId}`);
    }

    this.spinner.succeed('App installed on iOS device!');

    return fullBundleId;
  }

  private async findBundleIdFromSyslog(bundleId: string): Promise<string> {
    this.spinner.text = 'Looking for installed app...';

    const syslogCapture = spawn('idevicesyslog', [], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const foundBundleId = await new Promise<string>((resolve) => {
      let timeout: NodeJS.Timeout;
      let found = false;
      const safeBundleId = bundleId || '';

      const cleanup = () => {
        if (syslogCapture && !syslogCapture.killed) {
          try {
            syslogCapture.kill('SIGTERM');
            setTimeout(() => {
              if (syslogCapture && !syslogCapture.killed) {
                syslogCapture.kill('SIGKILL');
              }
            }, 1000);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      };

      syslogCapture.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        const patterns = [
          new RegExp(`(XTL-[A-Z0-9]+\\.${safeBundleId.replace(/\./g, '\\.')})`, 'i'),
          new RegExp(`bundleID[^:]*:\\s*([^\\s,}"]+${safeBundleId.split('.').pop()})`, 'i')
        ];

        for (const pattern of patterns) {
          const match = output.match(pattern);
          if (match && !found) {
            found = true;
            clearTimeout(timeout);
            cleanup();
            resolve(match[1]);
            return;
          }
        }
      });

      timeout = setTimeout(() => {
        if (!found) {
          cleanup();
          resolve(safeBundleId);
        }
      }, 2000);
    });

    return foundBundleId;
  }

  private showSuccessMessage(serverUrl: string): void {
    logger.log('');
    logger.info('📱 Please tap the app icon on your device to launch it.');
    logger.log('');
    logger.success(`App is connected to: ${serverUrl}`);
    logger.info('Monitoring console logs (Press Ctrl+C to stop)...');
    logger.log('');
  }

  private async monitorLogs(bundleId: string): Promise<void> {
    if (await this.checkCommandExists('idevicesyslog')) {
      this.platformProcess = spawn('idevicesyslog', ['-m', bundleId], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });

      this.platformProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            console.log(`📱 ${line.trim()}`);
          }
        }
      });

      this.platformProcess.stderr?.on('data', (data: Buffer) => {
        // Ignore stderr for syslog
      });

      this.platformProcess.on('exit', (code) => {
        if (!this.isCleaningUp && code !== 0) {
          logger.warn('Log monitoring stopped');
        }
      });
    } else {
      logger.warn('idevicesyslog not found. Install libimobiledevice for log monitoring.');
    }

    await new Promise(() => {});
  }
}
