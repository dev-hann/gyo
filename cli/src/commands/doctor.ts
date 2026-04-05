import { BaseCommand, CommandMeta } from './base/index';
import { logger } from '../utils/logger';
import { checkCommandExists, executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { GyoError } from '../core/index';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  optional?: boolean;
}

interface CheckConfig {
  name: string;
  command: string;
  versionArgs?: string[];
  versionParser?: (stdout: string) => string;
  notInstalledMessage?: string;
  optional?: boolean;
  minVersion?: { parse: (stdout: string) => number; required: number };
}

export class DoctorCommand extends BaseCommand {
  getMeta(): CommandMeta {
    return {
      name: 'doctor',
      description: 'Check your environment for required dependencies',
    };
  }

  protected async run(): Promise<void> {
    try {
      logger.info('Running gyo environment checks...\n');

      const checks = this.getCheckConfigs();
      const results: CheckResult[] = [];

      logger.info('Core Dependencies:');
      results.push(await this.runCheck(checks[0])); // Node.js
      results.push(await this.runCheck(checks[1])); // npm
      results.push(await this.runCheck(checks[2])); // Git

      logger.info('\nAndroid Development:');
      results.push(await this.checkAndroidSDK());
      results.push(await this.runCheck(checks[3])); // ADB
      results.push(await this.runCheck(checks[4])); // Gradle

      logger.info('\niOS Development:');
      results.push(await this.runCheck(checks[5])); // Swift
      results.push(await this.runCheck(checks[6])); // xtool
      results.push(await this.runCheck(checks[7])); // libimobiledevice

      this.displaySummary(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Doctor check failed: ${message}`);
      throw new GyoError(message);
    }
  }

  private getCheckConfigs(): CheckConfig[] {
    return [
      {
        name: 'Node.js',
        command: 'node',
        versionArgs: ['--version'],
        notInstalledMessage: 'Not installed. Visit https://nodejs.org',
        minVersion: {
          parse: (stdout) => parseInt(stdout.trim().replace('v', '').split('.')[0]),
          required: 18,
        },
        versionParser: (stdout) => stdout.trim(),
      },
      {
        name: 'npm',
        command: 'npm',
        versionArgs: ['--version'],
        versionParser: (stdout) => `v${stdout.trim()} installed`,
      },
      {
        name: 'Git',
        command: 'git',
        versionArgs: ['--version'],
        optional: true,
      },
      {
        name: 'ADB',
        command: 'adb',
        optional: true,
      },
      {
        name: 'Gradle',
        command: 'gradle',
        optional: true,
        notInstalledMessage: 'Not found (will use gradlew)',
      },
      {
        name: 'Swift',
        command: 'swift',
        versionArgs: ['--version'],
        versionParser: (stdout: string): string => {
          const match = stdout.match(/Swift version ([\d.]+)/);
          return match ? `Version ${match[1]}` : 'Installed';
        },
        notInstalledMessage: 'Not installed. Required for iOS development',
        optional: true,
      },
      {
        name: 'xtool',
        command: 'xtool',
        versionArgs: ['--version'],
        notInstalledMessage: 'Not installed. Visit https://xtool.sh for cross-platform iOS builds',
        optional: true,
      },
      {
        name: 'libimobiledevice',
        command: 'idevice_id',
        optional: true,
        notInstalledMessage: 'Not installed. Required for iOS device communication',
      },
    ];
  }

  private async runCheck(config: CheckConfig): Promise<CheckResult> {
    if (!config.command) {
      return {
        name: config.name,
        passed: false,
        message: config.notInstalledMessage || 'Not configured',
        optional: config.optional,
      };
    }

    const exists = await checkCommandExists(config.command);
    if (!exists) {
      return {
        name: config.name,
        passed: false,
        message: config.notInstalledMessage || 'Not installed',
        optional: config.optional,
      };
    }

    if (!config.versionArgs) {
      return {
        name: config.name,
        passed: true,
        message: 'Installed',
        optional: config.optional,
      };
    }

    const result = await executeCommand(config.command, config.versionArgs, { stdio: 'pipe' });

    if (!result.success) {
      return {
        name: config.name,
        passed: false,
        message: config.notInstalledMessage || `Failed to get version (exit code ${result.code})`,
        optional: config.optional,
      };
    }

    const versionOutput = config.versionParser
      ? config.versionParser(result.stdout)
      : result.stdout.trim();

    if (config.minVersion) {
      const currentVersion = config.minVersion.parse(result.stdout);
      const passed = currentVersion >= config.minVersion.required;
      return {
        name: config.name,
        passed,
        message: passed
          ? versionOutput
          : `${versionOutput} (requires v${config.minVersion.required} or higher)`,
        optional: config.optional,
      };
    }

    return {
      name: config.name,
      passed: true,
      message: versionOutput || 'Installed',
      optional: config.optional,
    };
  }

  private async checkAndroidSDK(): Promise<CheckResult> {
    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

    if (!androidHome) {
      return {
        name: 'Android SDK',
        passed: false,
        message: 'ANDROID_HOME not set',
        optional: true,
      };
    }

    if (!(await pathExists(androidHome))) {
      return {
        name: 'Android SDK',
        passed: false,
        message: `ANDROID_HOME is set but path does not exist: ${androidHome}`,
        optional: true,
      };
    }

    return {
      name: 'Android SDK',
      passed: true,
      message: `Found at ${androidHome}`,
      optional: true,
    };
  }

  private displaySummary(results: CheckResult[]): void {
    logger.info('\n' + '='.repeat(50));
    logger.info('Summary:\n');

    const required = results.filter((r) => !r.optional);
    const optional = results.filter((r) => r.optional);
    const passed = required.filter((r) => r.passed).length;

    for (const result of results) {
      if (result.passed) {
        logger.success(`${result.name}: ${result.message}`);
      } else if (result.optional) {
        logger.warn(`${result.name}: ${result.message} (optional)`);
      } else {
        logger.error(`${result.name}: ${result.message}`);
      }
    }

    logger.info('\n' + '='.repeat(50));
    logger.info(`\nPassed: ${passed}/${required.length} required checks`);

    if (optional.length > 0) {
      const passedOptional = optional.filter((r) => r.passed).length;
      logger.info(`Optional: ${passedOptional}/${optional.length} checks`);
    }

    if (passed === required.length) {
      logger.success('\nYour environment is ready for gyo development!');
    } else {
      logger.warn('\nSome checks failed. Please fix the issues above.');
    }
  }
}
