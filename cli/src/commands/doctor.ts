import type { CommandMeta } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { checkCommandExists, executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import * as path from 'path';
import * as fs from 'fs';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  category: string;
  optional?: boolean;
  installHint?: string;
}

interface CheckConfig {
  name: string;
  command: string;
  versionArgs?: string[];
  versionParser?: (stdout: string) => string;
  notInstalledMessage?: string;
  optional?: boolean;
  minVersion?: { parse: (stdout: string) => number; required: number };
  installHint?: string;
  category?: string;
}

export interface DoctorOptions {
  fix?: boolean;
  verbose?: boolean;
}

export class DoctorCommand extends BaseCommand<DoctorOptions> {
  private androidHome: string = '';
  private isLinux: boolean = false;
  private isMac: boolean = false;

  getMeta(): CommandMeta {
    return {
      name: 'doctor',
      description: 'Check your environment for required dependencies',
      options: [
        { flags: '--fix', description: 'Attempt to auto-install missing dependencies' },
        { flags: '-v, --verbose', description: 'Show detailed information' },
      ],
    };
  }

  protected async run(): Promise<void> {
    this.detectPlatform();
    this.androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';

    logger.info('Running gyo environment checks...\n');

    const results: CheckResult[] = [];

    logger.info('Core Dependencies:');
    await this.runGroup(results, [this.checkNode(), this.checkNpm(), this.checkGit()]);

    logger.info('\nAndroid Toolchain:');
    await this.runGroup(results, [
      this.checkJDK(),
      this.checkAndroidSDK(),
      this.checkAndroidPlatforms(),
      this.checkAndroidBuildTools(),
      this.checkADB(),
      this.checkGradle(),
    ]);

    logger.info('\niOS Toolchain:');
    await this.runGroup(results, [
      this.checkXtool(),
      this.checkDarwinSDK(),
      this.checkLibimobiledevice(),
      this.checkSwift(),
    ]);

    logger.info('\nAndroid Configuration:');
    await this.runGroup(results, [this.checkAndroidLicenses()]);

    this.displaySummary(results);

    if (this.options.fix) {
      await this.autoFix(results);
    } else if (results.some((r) => !r.passed)) {
      this.showFixSuggestions(results);
    }
  }

  private detectPlatform(): void {
    this.isLinux = process.platform === 'linux';
    this.isMac = process.platform === 'darwin';
  }

  private async runGroup(results: CheckResult[], checks: Promise<CheckResult>[]): Promise<void> {
    const groupResults = await Promise.all(checks);
    for (const result of groupResults) {
      results.push(result);
      this.displayCheck(result);
    }
  }

  private displayCheck(result: CheckResult): void {
    if (result.passed) {
      logger.success(`  [✓] ${result.name}: ${result.message}`);
    } else if (result.optional) {
      logger.warn(`  [!] ${result.name}: ${result.message}`);
    } else {
      logger.error(`  [✗] ${result.name}: ${result.message}`);
    }
    if (this.options.verbose && result.passed) {
      logger.log(`      ${result.message}`);
    }
  }

  private async checkNode(): Promise<CheckResult> {
    return this.runToolCheck({
      name: 'Node.js',
      command: 'node',
      versionArgs: ['--version'],
      notInstalledMessage: 'Not installed',
      installHint: this.getInstallHint('node'),
      minVersion: {
        parse: (stdout) => parseInt(stdout.trim().replace('v', '').split('.')[0]),
        required: 18,
      },
      versionParser: (stdout) => stdout.trim(),
      category: 'Core',
    });
  }

  private async checkNpm(): Promise<CheckResult> {
    return this.runToolCheck({
      name: 'npm',
      command: 'npm',
      versionArgs: ['--version'],
      versionParser: (stdout) => `v${stdout.trim()}`,
      notInstalledMessage: 'Not installed',
      installHint: this.getInstallHint('npm'),
      category: 'Core',
    });
  }

  private async checkGit(): Promise<CheckResult> {
    return this.runToolCheck({
      name: 'Git',
      command: 'git',
      versionArgs: ['--version'],
      optional: true,
      installHint: this.getInstallHint('git'),
      category: 'Core',
    });
  }

  private async checkJDK(): Promise<CheckResult> {
    const exists = await checkCommandExists('java');
    if (!exists) {
      return {
        name: 'JDK',
        passed: false,
        message: 'Not installed',
        category: 'Android',
        installHint: this.getInstallHint('jdk'),
      };
    }

    const result = await executeCommand('java', ['--version'], { stdio: 'pipe' });
    if (!result.success) {
      return {
        name: 'JDK',
        passed: false,
        message: 'Installed but version check failed',
        category: 'Android',
        installHint: this.getInstallHint('jdk'),
      };
    }

    const output = result.stderr || result.stdout;
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    let javaPath = '';
    const javaHome = process.env.JAVA_HOME;
    if (javaHome) {
      javaPath = javaHome;
    } else if (this.isLinux || this.isMac) {
      try {
        const whichResult = await executeCommand('which', ['java'], { stdio: 'pipe' });
        if (whichResult.success) {
          javaPath = whichResult.stdout.trim();
        }
      } catch {
        logger.debug('Failed to locate java via which');
      }
    }

    const majorVersion = parseInt(version.split('.')[0]);
    const passed = majorVersion >= 11;

    return {
      name: 'JDK',
      passed,
      message: `${version}${javaPath && this.options.verbose ? ` (${javaPath})` : ''}`,
      category: 'Android',
      installHint: passed ? undefined : this.getInstallHint('jdk'),
    };
  }

  private async checkAndroidSDK(): Promise<CheckResult> {
    const androidHome = this.androidHome;

    if (!androidHome) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const candidates = this.isMac
        ? [`${homeDir}/Library/Android/sdk`]
        : [`${homeDir}/Android/Sdk`, '/opt/android-sdk'];

      for (const candidate of candidates) {
        if (await pathExists(candidate)) {
          return {
            name: 'Android SDK',
            passed: true,
            message: `Found at ${candidate} (set ANDROID_HOME for reliability)`,
            category: 'Android',
            installHint: `Add to shell config:\n  export ANDROID_HOME=${candidate}`,
          };
        }
      }

      return {
        name: 'Android SDK',
        passed: false,
        message: 'ANDROID_HOME not set and no SDK found',
        category: 'Android',
        installHint: this.getInstallHint('android-sdk'),
      };
    }

    if (!(await pathExists(androidHome))) {
      return {
        name: 'Android SDK',
        passed: false,
        message: `ANDROID_HOME set but path does not exist: ${androidHome}`,
        category: 'Android',
        installHint: 'Verify your Android SDK installation path',
      };
    }

    return {
      name: 'Android SDK',
      passed: true,
      message: `${androidHome}`,
      category: 'Android',
    };
  }

  private async checkAndroidPlatforms(): Promise<CheckResult> {
    const sdkPath = this.androidHome;
    if (!sdkPath || !(await pathExists(sdkPath))) {
      return {
        name: 'Android SDK Platform',
        passed: false,
        message: 'SDK not found (see Android SDK check)',
        category: 'Android',
        optional: true,
      };
    }

    const platformsDir = path.join(sdkPath, 'platforms');
    if (!(await pathExists(platformsDir))) {
      return {
        name: 'Android SDK Platform',
        passed: false,
        message: 'No platforms installed',
        category: 'Android',
        installHint:
          'Install via Android Studio SDK Manager or:\n  sdkmanager "platforms;android-34"',
      };
    }

    try {
      const entries = fs.readdirSync(platformsDir).filter((e) => e.startsWith('android-'));
      if (entries.length === 0) {
        return {
          name: 'Android SDK Platform',
          passed: false,
          message: 'No platforms installed',
          category: 'Android',
          installHint:
            'Install via Android Studio SDK Manager or:\n  sdkmanager "platforms;android-34"',
        };
      }

      const versions = entries.map((e) => e.replace('android-', '')).join(', ');
      const hasRequired = entries.some((e) => {
        const v = parseInt(e.replace('android-', ''));
        return v >= 24;
      });

      return {
        name: 'Android SDK Platform',
        passed: hasRequired,
        message: `API ${versions}`,
        category: 'Android',
        installHint: hasRequired ? undefined : 'Gyo requires API 24+. Install via SDK Manager.',
      };
    } catch {
      return {
        name: 'Android SDK Platform',
        passed: false,
        message: 'Failed to read platforms directory',
        category: 'Android',
        optional: true,
      };
    }
  }

  private async checkAndroidBuildTools(): Promise<CheckResult> {
    const sdkPath = this.androidHome;
    if (!sdkPath || !(await pathExists(sdkPath))) {
      return {
        name: 'Android Build-Tools',
        passed: false,
        message: 'SDK not found (see Android SDK check)',
        category: 'Android',
        optional: true,
      };
    }

    const buildToolsDir = path.join(sdkPath, 'build-tools');
    if (!(await pathExists(buildToolsDir))) {
      return {
        name: 'Android Build-Tools',
        passed: false,
        message: 'No build-tools installed',
        category: 'Android',
        installHint:
          'Install via Android Studio SDK Manager or:\n  sdkmanager "build-tools;34.0.0"',
      };
    }

    try {
      const entries = fs.readdirSync(buildToolsDir).filter((e) => /^\d/.test(e));
      if (entries.length === 0) {
        return {
          name: 'Android Build-Tools',
          passed: false,
          message: 'No build-tools installed',
          category: 'Android',
          installHint:
            'Install via Android Studio SDK Manager or:\n  sdkmanager "build-tools;34.0.0"',
        };
      }

      return {
        name: 'Android Build-Tools',
        passed: true,
        message: entries.join(', '),
        category: 'Android',
      };
    } catch {
      return {
        name: 'Android Build-Tools',
        passed: false,
        message: 'Failed to read build-tools directory',
        category: 'Android',
        optional: true,
      };
    }
  }

  private async checkADB(): Promise<CheckResult> {
    return this.runToolCheck({
      name: 'ADB',
      command: 'adb',
      versionArgs: ['version'],
      versionParser: (stdout) => {
        const match = stdout.match(/Android Debug Bridge version ([\d.]+)/);
        return match ? match[1] : 'Installed';
      },
      optional: true,
      installHint: this.getInstallHint('adb'),
      category: 'Android',
    });
  }

  private async checkGradle(): Promise<CheckResult> {
    const exists = await checkCommandExists('gradle');
    if (!exists) {
      return {
        name: 'Gradle',
        passed: true,
        message: 'Not installed globally (gradlew will be used)',
        category: 'Android',
      };
    }

    const result = await executeCommand('gradle', ['--version'], { stdio: 'pipe' });
    if (!result.success) {
      return {
        name: 'Gradle',
        passed: true,
        message: 'Installed but version check failed',
        category: 'Android',
      };
    }

    const match = result.stdout.match(/Gradle ([\d.]+)/);
    return {
      name: 'Gradle',
      passed: true,
      message: match ? `v${match[1]} (global)` : 'Installed (global)',
      category: 'Android',
    };
  }

  private async checkAndroidLicenses(): Promise<CheckResult> {
    const sdkPath = this.androidHome;
    if (!sdkPath || !(await pathExists(sdkPath))) {
      return {
        name: 'Android SDK Licenses',
        passed: false,
        message: 'SDK not found (see Android SDK check)',
        category: 'Android',
        optional: true,
      };
    }

    const licensesDir = path.join(sdkPath, 'licenses');
    if (!(await pathExists(licensesDir))) {
      return {
        name: 'Android SDK Licenses',
        passed: false,
        message: 'Licenses directory not found — licenses not accepted',
        category: 'Android',
        installHint:
          'Accept SDK licenses:\n  yes | sdkmanager --licenses\n  Or via Android Studio: SDK Manager → SDK Tools → License',
      };
    }

    try {
      const licenseFiles = fs
        .readdirSync(licensesDir)
        .filter((f) => f.includes('license') || f.includes('License'));
      if (licenseFiles.length === 0) {
        return {
          name: 'Android SDK Licenses',
          passed: false,
          message: 'No license files found — licenses not accepted',
          category: 'Android',
          installHint:
            'Accept SDK licenses:\n  yes | sdkmanager --licenses\n  Or via Android Studio: SDK Manager → SDK Tools → License',
        };
      }

      const androidSdkLicense = licenseFiles.find(
        (f) => f === 'android-sdk-license' || f === 'android-sdk-arm-dbt-license'
      );
      if (!androidSdkLicense) {
        return {
          name: 'Android SDK Licenses',
          passed: false,
          message: `Found ${licenseFiles.length} license file(s) but android-sdk-license is missing`,
          category: 'Android',
          installHint: 'Accept SDK licenses:\n  yes | sdkmanager --licenses',
        };
      }

      return {
        name: 'Android SDK Licenses',
        passed: true,
        message: `Accepted (${licenseFiles.length} license file(s))`,
        category: 'Android',
      };
    } catch {
      return {
        name: 'Android SDK Licenses',
        passed: false,
        message: 'Failed to read licenses directory',
        category: 'Android',
        optional: true,
      };
    }
  }

  private async checkXtool(): Promise<CheckResult> {
    return this.runToolCheck({
      name: 'xtool',
      command: 'xtool',
      versionArgs: ['--version'],
      notInstalledMessage: 'Not installed',
      installHint: this.getInstallHint('xtool'),
      optional: true,
      category: 'iOS',
    });
  }

  private async checkDarwinSDK(): Promise<CheckResult> {
    const swiftExists = await checkCommandExists('swift');
    if (!swiftExists) {
      return {
        name: 'Darwin SDK',
        passed: false,
        message: 'Swift not installed (required for Darwin SDK)',
        category: 'iOS',
        optional: true,
        installHint: this.getInstallHint('swift'),
      };
    }

    const xtoolExists = await checkCommandExists('xtool');
    if (!xtoolExists) {
      return {
        name: 'Darwin SDK',
        passed: false,
        message: 'xtool not installed (required to install Darwin SDK)',
        category: 'iOS',
        optional: true,
        installHint: this.getInstallHint('xtool'),
      };
    }

    const result = await executeCommand('swift', ['sdk', 'list'], { stdio: 'pipe' });
    if (!result.success) {
      return {
        name: 'Darwin SDK',
        passed: false,
        message: 'Failed to list SDKs',
        category: 'iOS',
        optional: true,
        installHint: 'Run `xtool setup` to install the Darwin SDK',
      };
    }

    const hasDarwin = result.stdout.toLowerCase().includes('darwin');
    if (!hasDarwin) {
      return {
        name: 'Darwin SDK',
        passed: false,
        message: 'Not installed',
        category: 'iOS',
        optional: true,
        installHint: 'Run `xtool setup` to install the Darwin SDK (requires Xcode.xip from Apple)',
      };
    }

    return {
      name: 'Darwin SDK',
      passed: true,
      message: 'Installed',
      category: 'iOS',
    };
  }

  private async checkLibimobiledevice(): Promise<CheckResult> {
    const tools = ['idevice_id', 'idevicesyslog', 'ideviceinfo'];
    const missing: string[] = [];

    for (const tool of tools) {
      if (!(await checkCommandExists(tool))) {
        missing.push(tool);
      }
    }

    if (missing.length === tools.length) {
      return {
        name: 'libimobiledevice',
        passed: false,
        message: 'Not installed',
        category: 'iOS',
        optional: true,
        installHint: this.getInstallHint('libimobiledevice'),
      };
    }

    if (missing.length > 0) {
      return {
        name: 'libimobiledevice',
        passed: true,
        message: `Partially installed (missing: ${missing.join(', ')})`,
        category: 'iOS',
        optional: true,
        installHint: `Install missing tools: sudo apt install libimobiledevice-utils`,
      };
    }

    return {
      name: 'libimobiledevice',
      passed: true,
      message: 'Installed',
      category: 'iOS',
      optional: true,
    };
  }

  private async checkSwift(): Promise<CheckResult> {
    return this.runToolCheck({
      name: 'Swift',
      command: 'swift',
      versionArgs: ['--version'],
      versionParser: (stdout: string): string => {
        const match = stdout.match(/Swift version ([\d.]+)/);
        return match ? `v${match[1]}` : 'Installed';
      },
      notInstalledMessage: 'Not installed (required for xtool)',
      optional: true,
      installHint: this.getInstallHint('swift'),
      category: 'iOS',
    });
  }

  private async runToolCheck(config: CheckConfig): Promise<CheckResult> {
    const exists = await checkCommandExists(config.command);
    if (!exists) {
      return {
        name: config.name,
        passed: false,
        message: config.notInstalledMessage || 'Not installed',
        category: config.category || 'General',
        optional: config.optional,
        installHint: config.installHint,
      };
    }

    if (!config.versionArgs) {
      return {
        name: config.name,
        passed: true,
        message: 'Installed',
        category: config.category || 'General',
        optional: config.optional,
      };
    }

    const result = await executeCommand(config.command, config.versionArgs, { stdio: 'pipe' });

    if (!result.success) {
      return {
        name: config.name,
        passed: false,
        message: config.notInstalledMessage || `Failed to get version (exit code ${result.code})`,
        category: config.category || 'General',
        optional: config.optional,
        installHint: config.installHint,
      };
    }

    const versionOutput = config.versionParser
      ? config.versionParser(result.stdout)
      : result.stdout.trim();

    if (config.minVersion) {
      const currentVersion = config.minVersion.parse(result.stdout);
      const isValidVersion = !isNaN(currentVersion);
      const passed = isValidVersion && currentVersion >= config.minVersion.required;
      return {
        name: config.name,
        passed,
        message: passed
          ? versionOutput
          : isValidVersion
            ? `${versionOutput} (requires v${config.minVersion.required}+)`
            : `${versionOutput} (version format not recognized)`,
        category: config.category || 'General',
        optional: config.optional,
        installHint: passed ? undefined : config.installHint,
      };
    }

    return {
      name: config.name,
      passed: true,
      message: versionOutput || 'Installed',
      category: config.category || 'General',
      optional: config.optional,
    };
  }

  private displaySummary(results: CheckResult[]): void {
    logger.info('\n' + '='.repeat(60));
    logger.info('Platform Readiness:\n');

    const androidReady = this.isAndroidReady(results);
    const iosReady = this.isIOSReady(results);

    if (androidReady) {
      logger.success('  [✓] Android - Ready to build and run');
    } else {
      logger.warn('  [!] Android - Missing dependencies (see above)');
    }

    if (iosReady) {
      logger.success('  [✓] iOS     - Ready to build and run');
    } else {
      logger.warn('  [!] iOS     - Missing dependencies (see above)');
    }

    logger.info('\n' + '='.repeat(60));

    const required = results.filter((r) => !r.optional);
    const passed = required.filter((r) => r.passed).length;

    logger.info(`\nRequired: ${passed}/${required.length} checks passed`);

    if (required.length > 0 && passed === required.length) {
      logger.success('\nYour environment is ready for gyo development!');
    } else if (androidReady || iosReady) {
      logger.info('\nAt least one platform is ready. You can start developing!');
    } else {
      logger.error('\nNo platforms are ready. Please fix the issues above.');
    }
  }

  private isAndroidReady(results: CheckResult[]): boolean {
    const jdk = results.find((r) => r.name === 'JDK');
    const sdk = results.find((r) => r.name === 'Android SDK');
    const platforms = results.find((r) => r.name === 'Android SDK Platform');
    const buildTools = results.find((r) => r.name === 'Android Build-Tools');
    const licenses = results.find((r) => r.name === 'Android SDK Licenses');

    return !!(
      jdk?.passed &&
      sdk?.passed &&
      platforms?.passed &&
      buildTools?.passed &&
      licenses?.passed
    );
  }

  private isIOSReady(results: CheckResult[]): boolean {
    const xtool = results.find((r) => r.name === 'xtool');
    const darwinSDK = results.find((r) => r.name === 'Darwin SDK');

    return !!(xtool?.passed && darwinSDK?.passed);
  }

  private showFixSuggestions(results: CheckResult[]): void {
    const failed = results.filter((r) => !r.passed && r.installHint);
    if (failed.length === 0) return;

    logger.info('\n' + '='.repeat(60));
    logger.info('Fix missing dependencies:\n');

    for (const item of failed) {
      logger.info(`  ${item.name}:`);
      logger.info(`    ${item.installHint}`);
    }

    logger.info('');
    logger.info('Tip: Run `gyo doctor --fix` to auto-install where possible.');
  }

  private async autoFix(results: CheckResult[]): Promise<void> {
    const fixable = results.filter((r) => !r.passed && r.installHint);
    if (fixable.length === 0) {
      logger.success('\nAll checkable dependencies are installed!');
      return;
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('Auto-fixing missing dependencies...\n');

    if (this.isLinux) {
      await this.autoFixLinux(fixable);
    } else if (this.isMac) {
      await this.autoFixMac(fixable);
    } else {
      logger.warn('Auto-fix is not supported on this platform.');
      this.showFixSuggestions(results);
    }
  }

  private async autoFixLinux(fixable: CheckResult[]): Promise<void> {
    const aptPackages: string[] = [];
    const manualFix: CheckResult[] = [];

    for (const item of fixable) {
      switch (item.name) {
        case 'JDK':
          aptPackages.push('openjdk-17-jdk');
          break;
        case 'libimobiledevice':
          aptPackages.push('libimobiledevice-utils');
          break;
        case 'Git':
          aptPackages.push('git');
          break;
        default:
          manualFix.push(item);
          break;
      }
    }

    if (aptPackages.length > 0) {
      const pkgList = aptPackages.join(' ');
      logger.info(`Installing via apt: ${pkgList}\n`);
      const result = await executeCommand('sudo', ['apt', 'install', '-y', ...aptPackages], {
        stdio: 'inherit',
      });
      if (result.success) {
        logger.success('System packages installed successfully!');
      } else {
        logger.error('Failed to install system packages. Try manually:');
        logger.info(`  sudo apt install -y ${pkgList}`);
      }
    }

    if (manualFix.length > 0) {
      logger.info('\nManual installation required for:');
      for (const item of manualFix) {
        logger.info(`  ${item.name}: ${item.installHint}`);
      }
    }
  }

  private async autoFixMac(fixable: CheckResult[]): Promise<void> {
    const brewPackages: string[] = [];
    const manualFix: CheckResult[] = [];

    for (const item of fixable) {
      switch (item.name) {
        case 'Git':
          brewPackages.push('git');
          break;
        default:
          manualFix.push(item);
          break;
      }
    }

    if (brewPackages.length > 0) {
      const pkgList = brewPackages.join(' ');
      logger.info(`Installing via Homebrew: ${pkgList}\n`);
      const result = await executeCommand('brew', ['install', ...brewPackages], {
        stdio: 'inherit',
      });
      if (result.success) {
        logger.success('Homebrew packages installed successfully!');
      } else {
        logger.error('Failed to install Homebrew packages. Try manually:');
        logger.info(`  brew install ${pkgList}`);
      }
    }

    if (manualFix.length > 0) {
      logger.info('\nManual installation required for:');
      for (const item of manualFix) {
        logger.info(`  ${item.name}: ${item.installHint}`);
      }
    }
  }

  private getInstallHint(tool: string): string {
    const hints: Record<string, Record<string, string>> = {
      node: {
        linux: 'sudo apt install -y nodejs  or  https://nodejs.org',
        darwin: 'brew install node  or  https://nodejs.org',
        win32: 'https://nodejs.org  or  choco install nodejs-lts',
      },
      npm: {
        linux: 'sudo apt install -y npm  (usually included with Node.js)',
        darwin: 'Included with Node.js',
        win32: 'Included with Node.js',
      },
      git: {
        linux: 'sudo apt install -y git',
        darwin: 'brew install git  or  xcode-select --install',
        win32: 'https://git-scm.com  or  choco install git',
      },
      jdk: {
        linux: 'sudo apt install -y openjdk-17-jdk',
        darwin: 'brew install --cask zulu@17',
        win32: 'choco install -y microsoft-openjdk17',
      },
      'android-sdk': {
        linux:
          'Install Android Studio: https://developer.android.com/studio\n  Then set ANDROID_HOME in your shell config',
        darwin:
          'Install Android Studio: https://developer.android.com/studio\n  Then set ANDROID_HOME in your shell config',
        win32:
          'Install Android Studio: https://developer.android.com/studio\n  Then set ANDROID_HOME in your system environment',
      },
      adb: {
        linux:
          'Included with Android SDK. Set ANDROID_HOME and add to PATH:\n  export PATH=$PATH:$ANDROID_HOME/platform-tools',
        darwin:
          'Included with Android SDK. Set ANDROID_HOME and add to PATH:\n  export PATH=$PATH:$ANDROID_HOME/platform-tools',
        win32: 'Included with Android SDK. Add %ANDROID_HOME%\\platform-tools to PATH',
      },
      xtool: {
        linux:
          'Download the latest xtool AppImage:\n  curl -fL "https://github.com/xtool-org/xtool/releases/latest/download/xtool-$(uname -m).AppImage" -o xtool && chmod +x xtool && sudo mv xtool /usr/local/bin/',
        darwin: 'brew install xtool  or  visit https://xtool.sh',
        win32: 'Visit https://xtool.sh',
      },
      swift: {
        linux:
          'Install via swiftly:\n  curl -O https://download.swift.org/swiftly/linux/swiftly-$(uname -m).tar.gz && tar zxf swiftly-$(uname -m).tar.gz && ./swiftly init',
        darwin: 'Install Xcode from the App Store',
        win32: 'Install from https://swift.org/install',
      },
      libimobiledevice: {
        linux: 'sudo apt install -y libimobiledevice-utils',
        darwin: 'brew install libimobiledevice',
        win32: 'Not available on Windows',
      },
    };

    const platform = process.platform as string;
    const toolHints = hints[tool as keyof typeof hints];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!toolHints) return `Visit the official documentation for ${tool}`;

    return toolHints[platform] || toolHints['linux'] || `Install ${tool}`;
  }
}
