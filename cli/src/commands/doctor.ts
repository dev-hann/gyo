import * as path from 'path';
import * as fs from 'fs';
import type { CommandMeta } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { checkCommandExists, executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { getAndroidCompileSdk, getRequiredNodeMajor } from '../utils/paths';

export interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  category: Category;
  /** What may be missing on a machine that can still build for the other platform. */
  optional?: boolean;
  /** How to get what is missing, where that can be said. */
  installHint?: string;
  /** What would make the check pass, when a hint or `--fix` can name it. */
  install?: Installable;
}

export interface DoctorOptions {
  fix?: boolean;
  verbose?: boolean;
}

type Category = 'Core' | 'Android' | 'iOS';

/** What the install hints and `--fix` know how to get. */
type Installable =
  | 'node'
  | 'npm'
  | 'git'
  | 'jdk'
  | 'android-sdk'
  | 'adb'
  | 'xtool'
  | 'swift'
  | 'libimobiledevice';

/** The package managers `--fix` can drive. */
type PackageManager = 'apt' | 'brew';

/** What a check knows before it has run. */
type Known = Omit<CheckResult, 'passed' | 'message'>;

/** A tool whose version is the answer to one command. */
interface ToolCheck {
  name: string;
  category: Category;
  command: string;
  args: string[];
  /** The version as the user reads it, from what the command printed. */
  version: (output: string) => string;
  /** What to say when the tool is not installed, where "Not installed" is not enough. */
  missing?: string;
  /** The lowest major version that is enough. */
  minimum?: number;
  /** What may be missing on a machine that can still build for the other platform. */
  optional?: boolean;
  install: Installable;
}

/** The Android Gradle Plugin needs it, and the template compiles for Java 17. */
const REQUIRED_JDK_MAJOR = 17;

/** Install hints by platform; a platform without one of its own gets the Linux hint. */
type PlatformHints = Partial<Record<typeof process.platform, string>> & { linux: string };

const INSTALL_HINTS: Record<Installable, PlatformHints> = {
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
    linux: `sudo apt install -y openjdk-${REQUIRED_JDK_MAJOR}-jdk`,
    darwin: `brew install --cask zulu@${REQUIRED_JDK_MAJOR}`,
    win32: `choco install -y microsoft-openjdk${REQUIRED_JDK_MAJOR}`,
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

/** How `--fix` drives a package manager: the command it runs, and the name that goes by. */
const PACKAGE_MANAGERS: Record<PackageManager, { label: string; command: string[] }> = {
  apt: { label: 'apt', command: ['sudo', 'apt', 'install', '-y'] },
  brew: { label: 'Homebrew', command: ['brew', 'install'] },
};

/** The package a package manager gets for what a failed check named. The rest stays a hint. */
const FIXABLE: Record<PackageManager, Partial<Record<Installable, string>>> = {
  apt: {
    jdk: `openjdk-${REQUIRED_JDK_MAJOR}-jdk`,
    git: 'git',
    libimobiledevice: 'libimobiledevice-utils',
  },
  brew: { git: 'git' },
};

const ACCEPT_LICENSES =
  'Accept SDK licenses:\n  yes | sdkmanager --licenses\n  Or via Android Studio: SDK Manager → SDK Tools → License';

/**
 * The tools doctor asks for their version. Made when the command runs: the
 * Node release that is enough is read from a file, which no other command
 * should pay for, or fail on, at start-up.
 */
function toolChecks(): Record<'node' | 'npm' | 'git' | 'adb' | 'xtool' | 'swift', ToolCheck> {
  return {
    node: {
      name: 'Node.js',
      category: 'Core',
      command: 'node',
      args: ['--version'],
      version: (output) => output.trim(),
      minimum: getRequiredNodeMajor(),
      install: 'node',
    },
    npm: {
      name: 'npm',
      category: 'Core',
      command: 'npm',
      args: ['--version'],
      version: (output) => `v${output.trim()}`,
      install: 'npm',
    },
    git: {
      name: 'Git',
      category: 'Core',
      command: 'git',
      args: ['--version'],
      version: (output) => output.trim(),
      optional: true,
      install: 'git',
    },
    adb: {
      name: 'ADB',
      category: 'Android',
      command: 'adb',
      args: ['version'],
      version: (output) => captured(/Android Debug Bridge version ([\d.]+)/, output) ?? 'Installed',
      optional: true,
      install: 'adb',
    },
    xtool: {
      name: 'xtool',
      category: 'iOS',
      command: 'xtool',
      args: ['--version'],
      version: (output) => output.trim(),
      optional: true,
      install: 'xtool',
    },
    swift: {
      name: 'Swift',
      category: 'iOS',
      command: 'swift',
      args: ['--version'],
      version: (output) => {
        const version = captured(/Swift version ([\d.]+)/, output);
        return version ? `v${version}` : 'Installed';
      },
      missing: 'Not installed (required for xtool)',
      optional: true,
      install: 'swift',
    },
  };
}

/** The first capture of `pattern` in `output`; undefined when there is none. */
function captured(pattern: RegExp, output: string): string | undefined {
  return output.match(pattern)?.[1];
}

/** The version `java --version` prints, with or without a patch release: "17.0.20", "21", "1.8.0_392". */
function javaVersion(output: string): string {
  return output.match(/\d+(?:[._]\d+)*/)?.[0] ?? 'unknown';
}

/** The Java release a version belongs to: 8 for 1.8.0_392, 17 for 17.0.20, 21 for 21. */
function javaMajor(version: string): number {
  const [major, minor] = version.split(/[._]/).map(Number);
  return major === 1 ? minor : major;
}

export class DoctorCommand extends BaseCommand<DoctorOptions> {
  private androidHome = '';
  private isLinux = false;
  private isMac = false;

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
    // Both are read from files shipped with the CLI, when the command runs.
    const tools = toolChecks();
    const compileSdk = getAndroidCompileSdk();
    this.androidHome = await this.locateAndroidSdk();

    logger.info('Running gyo environment checks...\n');

    const results: CheckResult[] = [];

    logger.info('Core Dependencies:');
    await this.runGroup(results, [
      this.tool(tools.node),
      this.tool(tools.npm),
      this.tool(tools.git),
    ]);

    logger.info('\nAndroid Toolchain:');
    await this.runGroup(results, [
      this.checkJDK(),
      this.checkAndroidSDK(),
      this.checkSdkComponents(
        'Android SDK Platform',
        'platforms',
        `sdkmanager "platforms;android-${compileSdk}"`,
        compileSdk
      ),
      this.checkSdkComponents(
        'Android Build-Tools',
        'build-tools',
        `sdkmanager "build-tools;${compileSdk}.0.0}"`,
        compileSdk
      ),
      this.tool(tools.adb),
      this.checkGradle(),
    ]);

    logger.info('\niOS Toolchain:');
    await this.runGroup(results, [
      this.tool(tools.xtool),
      this.checkDarwinSDK(),
      this.checkLibimobiledevice(),
      this.tool(tools.swift),
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
    for (const result of await Promise.all(checks)) {
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

  private installHint(install: Installable): string {
    const hints: PlatformHints = INSTALL_HINTS[install];
    return hints[process.platform] ?? hints.linux;
  }

  /** Runs a tool that answers one command, and judges what it printed. */
  private async tool(check: ToolCheck): Promise<CheckResult> {
    const base: Known = {
      name: check.name,
      category: check.category,
      optional: check.optional,
      install: check.install,
      installHint: this.installHint(check.install),
    };

    if (!(await checkCommandExists(check.command))) {
      return { ...base, passed: false, message: check.missing ?? 'Not installed' };
    }

    const output = await executeCommand(check.command, check.args, { stdio: 'pipe' });
    if (!output.success) {
      return {
        ...base,
        passed: false,
        message: `Failed to get version (exit code ${output.code})`,
      };
    }

    const shown = check.version(output.stdout);
    const major = Number.parseInt(shown.replace(/^v/, ''), 10);
    // NaN is never enough: a version that could not be read fails the check.
    const enough = check.minimum === undefined || major >= check.minimum;

    if (!enough) {
      const why = Number.isNaN(major)
        ? 'version format not recognized'
        : `requires v${check.minimum}+`;
      return { ...base, passed: false, message: `${shown} (${why})` };
    }

    return { ...base, passed: true, message: shown || 'Installed' };
  }

  private async checkJDK(): Promise<CheckResult> {
    const base: Known = {
      name: 'JDK',
      category: 'Android',
      install: 'jdk',
      installHint: this.installHint('jdk'),
    };

    if (!(await checkCommandExists('java'))) {
      return { ...base, passed: false, message: 'Not installed' };
    }

    const output = await executeCommand('java', ['--version'], { stdio: 'pipe' });
    if (!output.success) {
      return { ...base, passed: false, message: 'Installed but version check failed' };
    }

    const version = javaVersion(output.stderr || output.stdout);
    // Shown only where Java can be looked for: not on a platform without `which`.
    const location = this.options.verbose ? await this.javaLocation() : '';
    return {
      ...base,
      passed: javaMajor(version) >= REQUIRED_JDK_MAJOR,
      message: `${version}${location ? ` (${location})` : ''}`,
    };
  }

  /** Where Java lives, for the verbose listing: JAVA_HOME when set, else what `which` says. */
  private async javaLocation(): Promise<string> {
    if (process.env.JAVA_HOME) {
      return process.env.JAVA_HOME;
    }
    if (!this.isLinux && !this.isMac) {
      return '';
    }
    try {
      const which = await executeCommand('which', ['java'], { stdio: 'pipe' });
      return which.success ? which.stdout.trim() : '';
    } catch {
      logger.debug('Failed to locate java via which');
      return '';
    }
  }

  /**
   * Where the SDK is: the variable that names it, or the usual place. The
   * checks run at the same time, so none of them may depend on another
   * having found it first.
   */
  private async locateAndroidSdk(): Promise<string> {
    const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (fromEnv) {
      return fromEnv;
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const candidates = this.isMac
      ? [`${homeDir}/Library/Android/sdk`]
      : [`${homeDir}/Android/Sdk`, `${homeDir}/android-sdk`, '/opt/android-sdk'];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
    return '';
  }

  private async checkAndroidSDK(): Promise<CheckResult> {
    const base: Known = { name: 'Android SDK', category: 'Android' };

    if (!this.androidHome) {
      return {
        ...base,
        passed: false,
        message: 'ANDROID_HOME not set and no SDK found',
        install: 'android-sdk',
        installHint: this.installHint('android-sdk'),
      };
    }

    if (!(await pathExists(this.androidHome))) {
      return {
        ...base,
        passed: false,
        message: `ANDROID_HOME set but path does not exist: ${this.androidHome}`,
        installHint: 'Verify your Android SDK installation path',
      };
    }

    const namedByEnv = Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT);
    return {
      ...base,
      passed: true,
      message: namedByEnv
        ? this.androidHome
        : `Found at ${this.androidHome} (set ANDROID_HOME for reliability)`,
      installHint: namedByEnv
        ? undefined
        : `Add to shell config:\n  export ANDROID_HOME=${this.androidHome}`,
    };
  }

  /**
   * One folder of the SDK that holds versioned parts, platforms or
   * build-tools. `sdkmanager` is the command that gets what is missing.
   */
  private async checkSdkComponents(
    name: string,
    folder: 'platforms' | 'build-tools',
    sdkmanager: string,
    compileSdk: number
  ): Promise<CheckResult> {
    const base: Known = { name, category: 'Android' };
    const missing = `Install via Android Studio SDK Manager or:\n  ${sdkmanager}`;

    if (!this.androidHome || !(await pathExists(this.androidHome))) {
      return {
        ...base,
        passed: false,
        message: 'SDK not found (see Android SDK check)',
        optional: true,
      };
    }

    const dir = path.join(this.androidHome, folder);
    if (!(await pathExists(dir))) {
      return { ...base, passed: false, message: `No ${folder} installed`, installHint: missing };
    }

    let versions: string[];
    try {
      versions = fs
        .readdirSync(dir)
        .filter((entry) => /^\d/.test(entry.replace('android-', '')))
        .map((entry) => entry.replace('android-', ''));
    } catch {
      return {
        ...base,
        passed: false,
        message: `Failed to read ${folder} directory`,
        optional: true,
      };
    }

    if (versions.length === 0) {
      return { ...base, passed: false, message: `No ${folder} installed`, installHint: missing };
    }

    // A platform has to be the one the template compiles against or newer;
    // any build-tools version builds it.
    const hasWhatIsNeeded =
      folder === 'build-tools' || versions.some((version) => parseInt(version, 10) >= compileSdk);

    return {
      ...base,
      passed: hasWhatIsNeeded,
      message: folder === 'platforms' ? `API ${versions.join(', ')}` : versions.join(', '),
      installHint: hasWhatIsNeeded
        ? undefined
        : `Gyo compiles against API ${compileSdk}. Install it via SDK Manager.`,
    };
  }

  private async checkGradle(): Promise<CheckResult> {
    const base: Known = { name: 'Gradle', category: 'Android' };

    // The project's wrapper brings its own Gradle; a global one is a convenience.
    if (!(await checkCommandExists('gradle'))) {
      return { ...base, passed: true, message: 'Not installed globally (gradlew will be used)' };
    }

    const output = await executeCommand('gradle', ['--version'], { stdio: 'pipe' });
    if (!output.success) {
      return { ...base, passed: true, message: 'Installed but version check failed' };
    }

    const version = captured(/Gradle ([\d.]+)/, output.stdout);
    return {
      ...base,
      passed: true,
      message: version ? `v${version} (global)` : 'Installed (global)',
    };
  }

  private async checkAndroidLicenses(): Promise<CheckResult> {
    const base: Known = { name: 'Android SDK Licenses', category: 'Android' };

    if (!this.androidHome || !(await pathExists(this.androidHome))) {
      return {
        ...base,
        passed: false,
        message: 'SDK not found (see Android SDK check)',
        optional: true,
      };
    }

    const licensesDir = path.join(this.androidHome, 'licenses');
    if (!(await pathExists(licensesDir))) {
      return {
        ...base,
        passed: false,
        message: 'Licenses directory not found — licenses not accepted',
        installHint: ACCEPT_LICENSES,
      };
    }

    let files: string[];
    try {
      files = fs
        .readdirSync(licensesDir)
        .filter((file) => file.includes('license') || file.includes('License'));
    } catch {
      return {
        ...base,
        passed: false,
        message: 'Failed to read licenses directory',
        optional: true,
      };
    }

    if (files.length === 0) {
      return {
        ...base,
        passed: false,
        message: 'No license files found — licenses not accepted',
        installHint: ACCEPT_LICENSES,
      };
    }

    // The licence a build needs; the preview licences next to it do not stand in for it.
    const accepted = files.includes('android-sdk-license');
    if (!accepted) {
      return {
        ...base,
        passed: false,
        message: `Found ${files.length} license file(s) but android-sdk-license is missing`,
        installHint: 'Accept SDK licenses:\n  yes | sdkmanager --licenses',
      };
    }

    return { ...base, passed: true, message: `Accepted (${files.length} license file(s))` };
  }

  /** The Darwin SDK that xtool builds with: it is there once `xtool setup` ran. */
  private async checkDarwinSDK(): Promise<CheckResult> {
    const base: Known = { name: 'Darwin SDK', category: 'iOS', optional: true };
    const setup = 'Run `xtool setup` to install the Darwin SDK';

    if (!(await checkCommandExists('swift'))) {
      return {
        ...base,
        passed: false,
        message: 'Swift not installed (required for Darwin SDK)',
        install: 'swift',
        installHint: this.installHint('swift'),
      };
    }
    if (!(await checkCommandExists('xtool'))) {
      return {
        ...base,
        passed: false,
        message: 'xtool not installed (required to install Darwin SDK)',
        install: 'xtool',
        installHint: this.installHint('xtool'),
      };
    }

    const sdks = await executeCommand('swift', ['sdk', 'list'], { stdio: 'pipe' });
    if (!sdks.success) {
      return { ...base, passed: false, message: 'Failed to list SDKs', installHint: setup };
    }

    return sdks.stdout.toLowerCase().includes('darwin')
      ? { ...base, passed: true, message: 'Installed' }
      : {
          ...base,
          passed: false,
          message: 'Not installed',
          installHint: `${setup} (requires Xcode.xip from Apple)`,
        };
  }

  private async checkLibimobiledevice(): Promise<CheckResult> {
    const tools = ['idevice_id', 'idevicesyslog', 'ideviceinfo'];
    const present = await Promise.all(tools.map((tool) => checkCommandExists(tool)));
    const missing = tools.filter((_, index) => !present[index]);

    const base: Known = {
      name: 'libimobiledevice',
      category: 'iOS',
      optional: true,
      install: 'libimobiledevice',
      installHint: this.installHint('libimobiledevice'),
    };

    if (missing.length === tools.length) {
      return { ...base, passed: false, message: 'Not installed' };
    }
    return {
      ...base,
      passed: true,
      message:
        missing.length > 0 ? `Partially installed (missing: ${missing.join(', ')})` : 'Installed',
    };
  }

  private displaySummary(results: CheckResult[]): void {
    logger.info('\n' + '='.repeat(60));
    logger.info('Platform Readiness:\n');

    const androidReady = [
      'JDK',
      'Android SDK',
      'Android SDK Platform',
      'Android Build-Tools',
      'Android SDK Licenses',
    ].every((name) => results.find((r) => r.name === name)?.passed);
    const iosReady = ['xtool', 'Darwin SDK'].every(
      (name) => results.find((r) => r.name === name)?.passed
    );

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

  private showFixSuggestions(results: CheckResult[]): void {
    const failed = results.filter((r) => !r.passed && r.installHint);
    if (failed.length === 0) return;

    // The summary just said the environment is ready when only optional
    // tools are missing: the list must not contradict it.
    const optionalOnly = failed.every((item) => item.optional);

    logger.info('\n' + '='.repeat(60));
    logger.info(optionalOnly ? 'Optional tools:\n' : 'Fix missing dependencies:\n');

    for (const item of failed) {
      logger.info(`  ${item.name}:`);
      logger.info(`    ${item.installHint}`);
    }

    if (!this.options.fix) {
      logger.info('\nTip: Run `gyo doctor --fix` to install what it can by itself.');
    }
  }

  /** Installs what the package manager can get; the rest stays a hint. */
  private async autoFix(results: CheckResult[]): Promise<void> {
    const failed = results.filter((r) => !r.passed && r.installHint);
    if (failed.length === 0) {
      logger.success('\nAll checkable dependencies are installed!');
      return;
    }

    // As in the list without `--fix`: what a machine may lack and still be
    // ready is not called a missing dependency.
    const optionalOnly = failed.every((item) => item.optional);

    logger.info('\n' + '='.repeat(60));
    logger.info(
      optionalOnly ? 'Installing optional tools...\n' : 'Auto-fixing missing dependencies...\n'
    );

    const manager: PackageManager | undefined = this.isLinux
      ? 'apt'
      : this.isMac
        ? 'brew'
        : undefined;
    if (!manager) {
      logger.warn('Auto-fix is not supported on this platform.');
      this.showFixSuggestions(results);
      return;
    }

    const packageFor = (item: CheckResult): string | undefined =>
      item.install ? FIXABLE[manager][item.install] : undefined;
    const toInstall = failed.map(packageFor).filter((name): name is string => name !== undefined);
    const manual = failed.filter((item) => packageFor(item) === undefined);

    if (toInstall.length > 0) {
      const { label, command } = PACKAGE_MANAGERS[manager];
      const list = toInstall.join(' ');
      logger.info(`Installing via ${label}: ${list}\n`);

      const [program, ...args] = command;
      const installed = await executeCommand(program, [...args, ...toInstall], {
        stdio: 'inherit',
      });

      if (installed.success) {
        logger.success(`\nInstalled with ${label}: ${list}`);
      } else {
        logger.error(`\nFailed to install with ${label}. Run this by hand:`);
        logger.info(`  ${[...command, ...toInstall].join(' ')}`);
      }
    }

    if (manual.length > 0) {
      logger.info(
        optionalOnly
          ? '\nOptional tools to install by hand:'
          : '\nManual installation required for:'
      );
      for (const item of manual) {
        logger.info(`  ${item.name}: ${item.installHint}`);
      }
    }
  }
}
