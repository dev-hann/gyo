import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import type { DoctorOptions } from '../commands/doctor';
import { DoctorCommand } from '../commands/doctor';
import type { ExecResult } from '../utils/exec';
import { checkCommandExists, executeCommand } from '../utils/exec';
import { getAndroidCompileSdk, getRequiredNodeMajor } from '../utils/paths';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';

// Only what leaves the process is mocked: the tools doctor asks for their
// version, and the package manager that --fix drives. The SDK is on disk.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
}));

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot
// run. The two numbers doctor reads are read here from the files the CLI
// ships, as it reads them.
jest.mock('../utils/paths', () => {
  const fs = jest.requireActual('fs');
  const path = jest.requireActual('path');
  const cli = (...segments: string[]): string => path.join(__dirname, '../..', ...segments);
  return {
    getRequiredNodeMajor: (): number =>
      Number(
        JSON.parse(fs.readFileSync(cli('package.json'), 'utf-8')).engines.node.match(/\d+/)[0]
      ),
    getAndroidCompileSdk: (): number =>
      Number(
        fs
          .readFileSync(cli('templates', 'android', 'app', 'build.gradle'), 'utf-8')
          .match(/compileSdk\s*=?\s*(\d+)/)[1]
      ),
  };
});

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;

// What doctor asks for, read as it reads them when it runs.
const NODE_MAJOR = getRequiredNodeMajor();
const COMPILE_SDK = getAndroidCompileSdk();

/** The tools doctor looks for on the PATH. */
const TOOLS = [
  'node',
  'npm',
  'git',
  'java',
  'adb',
  'gradle',
  'xtool',
  'swift',
  'idevice_id',
  'idevicesyslog',
  'ideviceinfo',
];

/** The command lines doctor runs to read a tool's version, and the SDKs Swift has. */
const ASKED: Array<[string, string[]]> = [
  ['node', ['--version']],
  ['npm', ['--version']],
  ['git', ['--version']],
  ['java', ['--version']],
  ['adb', ['version']],
  ['gradle', ['--version']],
  ['xtool', ['--version']],
  ['swift', ['--version']],
  ['swift', ['sdk', 'list']],
];

/** The machine as doctor finds it. */
interface Machine {
  /** The tools that `which` finds. */
  onPath: string[];
  /** What a command line prints, in place of what it prints with everything installed. */
  output: Record<string, Partial<ExecResult>>;
}

/** What each command line prints on a machine that has everything. */
const INSTALLED: Record<string, Partial<ExecResult>> = {
  'node --version': { stdout: `v${NODE_MAJOR}.0.0` },
  'npm --version': { stdout: '10.9.0' },
  'git --version': { stdout: 'git version 2.47.0' },
  'java --version': { stderr: 'openjdk 17.0.20 2026-07-21' },
  'adb version': { stdout: 'Android Debug Bridge version 35.0.2' },
  'gradle --version': { stdout: 'Gradle 8.11.1' },
  'xtool --version': { stdout: 'xtool 1.0.0' },
  'swift --version': { stdout: 'Swift version 6.0.3' },
  'swift sdk list': { stdout: 'darwin\n' },
};

let machine: Machine;
let workDir: string;
let homeDir: string;

/** Puts tools on the PATH; each prints what it does with everything installed. */
function have(...tools: string[]): void {
  machine.onPath.push(...tools);
}

/** Makes a command line print something else. */
function prints(commandLine: string, output: Partial<ExecResult>): void {
  machine.output[commandLine] = output;
}

/** An SDK at `root`: an empty file for every entry, an empty folder for one that ends in a slash. */
function sdkAt(root: string, ...entries: string[]): string {
  fs.ensureDirSync(root);
  for (const entry of entries) {
    const target = path.join(root, entry);
    if (entry.endsWith('/')) {
      fs.ensureDirSync(target);
    } else {
      fs.outputFileSync(target, '');
    }
  }
  return root;
}

/** An Android SDK that ANDROID_HOME names. */
function sdk(...entries: string[]): string {
  const home = sdkAt(path.join(workDir, 'sdk'), ...entries);
  process.env.ANDROID_HOME = home;
  return home;
}

/** An Android SDK with the platform, the build-tools and the license that the template builds with. */
function completeSdk(): string {
  return sdk(
    `platforms/android-${COMPILE_SDK}`,
    `build-tools/${COMPILE_SDK}.0.0`,
    'licenses/android-sdk-license'
  );
}

/** An Android SDK where a home directory usually keeps one. */
function sdkInHomeDir(...entries: string[]): string {
  return sdkAt(path.join(homeDir, 'Android', 'Sdk'), ...entries);
}

/** Makes doctor take the machine for one running `value`, until the test ends. */
function onPlatform(value: typeof process.platform): void {
  Object.defineProperty(process, 'platform', { value });
}

// Taken before any test changes them.
const environment = {
  ANDROID_HOME: process.env.ANDROID_HOME,
  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT,
  JAVA_HOME: process.env.JAVA_HOME,
  HOME: process.env.HOME,
};
const platform = process.platform;

describe('DoctorCommand', () => {
  /** Runs `gyo doctor` with these options. */
  function doctor(options: DoctorOptions = {}): Promise<void> {
    const command = new DoctorCommand();
    command.setOptions(options);
    return command.execute();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
    machine = { onPath: [], output: {} };
    mockedCheck.mockImplementation((command) => Promise.resolve(machine.onPath.includes(command)));
    mockedExec.mockImplementation((command, args = []) => {
      const line = [command, ...args].join(' ');
      return Promise.resolve({
        success: true,
        stdout: '',
        stderr: '',
        code: 0,
        ...INSTALLED[line],
        ...machine.output[line],
      });
    });

    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-doctor-'));
    homeDir = path.join(workDir, 'home');
    fs.ensureDirSync(homeDir);
    // Nothing of the machine running the test is found: no variable names an
    // SDK or a JDK, and the home directory is empty. (/opt/android-sdk is the
    // one place a test cannot empty; nothing below depends on its absence.)
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
    delete process.env.JAVA_HOME;
    process.env.HOME = homeDir;
  });

  afterEach(() => {
    onPlatform(platform);
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    logger.resetVerbose();
    fs.removeSync(workDir);
  });

  describe('run', () => {
    it('should pass when all core tools are installed', async () => {
      have(...TOOLS);
      completeSdk();

      await doctor();

      expect(logger.success).toHaveBeenCalledWith('  [✓] Android - Ready to build and run');
      expect(logger.success).toHaveBeenCalledWith('  [✓] iOS     - Ready to build and run');
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      // Every tool was looked for and asked; the folders of the SDK were read.
      expect(mockedCheck.mock.calls).toEqual(expect.arrayContaining(TOOLS.map((tool) => [tool])));
      expect(mockedExec.mock.calls).toEqual(
        expect.arrayContaining(ASKED.map(([command, args]) => [command, args, { stdio: 'pipe' }]))
      );
      expect(mockedExec).toHaveBeenCalledTimes(ASKED.length);
    });

    it('should fail when node is not installed', async () => {
      await doctor();

      expect(logger.error).toHaveBeenCalledWith('  [✗] Node.js: Not installed');
      expect(logger.error).toHaveBeenCalledWith(
        '\nNo platforms are ready. Please fix the issues above.'
      );
    });

    it.each([
      {
        named: 'ANDROID_HOME',
        name: (home: string): void => {
          process.env.ANDROID_HOME = home;
        },
      },
      {
        named: 'ANDROID_SDK_ROOT when ANDROID_HOME is not set',
        name: (home: string): void => {
          process.env.ANDROID_SDK_ROOT = home;
        },
      },
      {
        named: 'ANDROID_HOME when both are set',
        name: (home: string): void => {
          process.env.ANDROID_HOME = home;
          process.env.ANDROID_SDK_ROOT = path.join(workDir, 'other-sdk');
        },
      },
    ])('should find an SDK named by $named', async ({ name }) => {
      // No variable names the SDK until the row names one.
      const home = sdkAt(path.join(workDir, 'sdk'));
      name(home);
      await doctor();

      expect(logger.success).toHaveBeenCalledWith(`  [✓] Android SDK: ${home}`);
    });

    it('should warn when ANDROID_HOME path does not exist', async () => {
      process.env.ANDROID_HOME = path.join(workDir, 'nowhere');

      await doctor();

      expect(logger.error).toHaveBeenCalledWith(
        `  [✗] Android SDK: ANDROID_HOME set but path does not exist: ${process.env.ANDROID_HOME}`
      );
    });

    it('should detect installed Android platforms', async () => {
      sdk(`platforms/android-${COMPILE_SDK}`, `platforms/android-${COMPILE_SDK + 1}`);

      await doctor();

      expect(logger.success).toHaveBeenCalledWith(
        `  [✓] Android SDK Platform: API ${COMPILE_SDK}, ${COMPILE_SDK + 1}`
      );
    });

    it('should detect installed Android build-tools', async () => {
      // Any build-tools version builds the project: these older ones are enough.
      sdk('build-tools/34.0.0', 'build-tools/35.0.0');

      await doctor();

      expect(logger.success).toHaveBeenCalledWith('  [✓] Android Build-Tools: 34.0.0, 35.0.0');
    });

    it.each([
      [
        'JAVA_HOME',
        (jdk: string): void => {
          process.env.JAVA_HOME = jdk;
        },
      ],
      [
        'which java',
        (jdk: string): void => {
          prints('which java', { stdout: jdk });
        },
      ],
    ])('should say in verbose mode where Java is, from %s', async (_, locate) => {
      onPlatform('linux');
      have('java');
      const jdk = path.join(workDir, 'jdk');
      locate(jdk);

      await doctor({ verbose: true });

      expect(logger.success).toHaveBeenCalledWith(`  [✓] JDK: 17.0.20 (${jdk})`);
    });

    it('should leave the location out where Java cannot be looked for', async () => {
      onPlatform('win32');
      delete process.env.JAVA_HOME;
      have('java');

      await doctor({ verbose: true });

      expect(logger.success).toHaveBeenCalledWith('  [✓] JDK: 17.0.20');
    });

    it('should report xtool as optional iOS dependency', async () => {
      have('node', 'npm', 'git');

      await doctor();

      expect(logger.warn).toHaveBeenCalledWith('  [!] xtool: Not installed');
      expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('xtool'));
    });

    it('should show install hints for missing tools', async () => {
      onPlatform('linux');

      await doctor();

      expect(logger.info).toHaveBeenCalledWith('Fix missing dependencies:\n');
      expect(logger.info).toHaveBeenCalledWith(
        '    sudo apt install -y nodejs  or  https://nodejs.org'
      );
      expect(logger.info).toHaveBeenCalledWith(
        '\nTip: Run `gyo doctor --fix` to install what it can by itself.'
      );
    });

    it('should show platform readiness summary', async () => {
      await doctor();

      expect(logger.info).toHaveBeenCalledWith('Platform Readiness:\n');
      expect(logger.warn).toHaveBeenCalledWith('  [!] Android - Missing dependencies (see above)');
      expect(logger.warn).toHaveBeenCalledWith('  [!] iOS     - Missing dependencies (see above)');
    });

    it('should detect Darwin SDK when installed', async () => {
      have('xtool', 'swift');

      await doctor();

      expect(logger.success).toHaveBeenCalledWith('  [✓] Darwin SDK: Installed');
    });

    it('should warn when Darwin SDK is not installed', async () => {
      have('xtool', 'swift');
      prints('swift sdk list', { stdout: 'No Swift SDKs are currently installed.\n' });

      await doctor();

      expect(logger.warn).toHaveBeenCalledWith('  [!] Darwin SDK: Not installed');
    });

    it('should detect accepted Android SDK licenses', async () => {
      sdk('licenses/android-sdk-license', 'licenses/android-sdk-arm-dbt-license');

      await doctor();

      expect(logger.success).toHaveBeenCalledWith(
        '  [✓] Android SDK Licenses: Accepted (2 license file(s))'
      );
    });

    it('should not take another licence for the one a build needs', async () => {
      sdk('licenses/android-sdk-arm-dbt-license');

      await doctor();

      expect(logger.error).toHaveBeenCalledWith(
        '  [✗] Android SDK Licenses: Found 1 license file(s) but android-sdk-license is missing'
      );
    });

    it.each([
      [[], 'Licenses directory not found — licenses not accepted'],
      [['licenses/'], 'No license files found — licenses not accepted'],
      [
        ['licenses/android-sdk-preview-license'],
        'Found 1 license file(s) but android-sdk-license is missing',
      ],
    ])('should warn when Android SDK licenses not accepted: %j', async (entries, message) => {
      sdk(...entries);

      await doctor();

      expect(logger.error).toHaveBeenCalledWith(`  [✗] Android SDK Licenses: ${message}`);
    });

    it('should require Darwin SDK for iOS readiness even when xtool is installed', async () => {
      have('xtool', 'swift');
      prints('swift sdk list', { stdout: 'No Swift SDKs are currently installed.\n' });

      await doctor();

      expect(logger.warn).toHaveBeenCalledWith('  [!] iOS     - Missing dependencies (see above)');
    });
  });

  // What doctor requires is what the CLI and the generated project need, not
  // a number of its own: it used to call Node 18, JDK 11 and API 24 enough.
  describe('requirements', () => {
    beforeEach(() => {
      // Only Node and Java are installed, and both answer: what they print is what varies.
      have('node', 'java');
    });

    it('should fail a Node release older than the one the CLI installs on', async () => {
      prints('node --version', { stdout: `v${NODE_MAJOR - 1}.0.0` });

      await doctor();

      expect(logger.error).toHaveBeenCalledWith(
        `  [✗] Node.js: v${NODE_MAJOR - 1}.0.0 (requires v${NODE_MAJOR}+)`
      );
    });

    it.each([
      ['openjdk 11.0.22 2024-01-01', false],
      ['openjdk 17.0.20 2026-07-21', true],
      ['openjdk 21 2023-09-19', true],
      ['openjdk 1.8.0_392', false],
    ])('should read the Java release from "%s" as enough: %s', async (versionOutput, enough) => {
      prints('java --version', { stderr: versionOutput });

      await doctor();

      const line = expect.stringContaining(`JDK: ${versionOutput.split(' ')[1]}`);
      if (enough) {
        expect(logger.success).toHaveBeenCalledWith(line);
      } else {
        expect(logger.error).toHaveBeenCalledWith(line);
      }
    });

    it('should want the platform the template compiles against', async () => {
      sdk(`platforms/android-${COMPILE_SDK - 1}`);

      await doctor();

      expect(logger.error).toHaveBeenCalledWith(
        `  [✗] Android SDK Platform: API ${COMPILE_SDK - 1}`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `    Gyo compiles against API ${COMPILE_SDK}. Install it via SDK Manager.`
      );
    });

    it('should look for that platform where it found the SDK', async () => {
      // No variable names an SDK: the one in the home directory is found.
      const usual = sdkInHomeDir(`platforms/android-${COMPILE_SDK}`);

      await doctor();

      expect(logger.success).toHaveBeenCalledWith(
        `  [✓] Android SDK: Found at ${usual} (set ANDROID_HOME for reliability)`
      );
      expect(logger.success).toHaveBeenCalledWith(`  [✓] Android SDK Platform: API ${COMPILE_SDK}`);
    });
  });

  // `--fix` runs the machine's package manager, with sudo on Linux: what it
  // installs follows from what a failed check named, never from everything
  // that failed.
  describe('--fix', () => {
    /** node and npm answer; java is there when `javaOutput` is a string, and prints it. */
    function tools(javaOutput: string | null): void {
      have('node', 'npm');
      if (javaOutput !== null) {
        have('java');
        prints('java --version', { stderr: javaOutput });
      }
    }

    /** Everything a machine needs for both platforms is in place. */
    function everythingInstalled(): void {
      have(...TOOLS);
      completeSdk();
    }

    it('should call what it installs and what it leaves optional when only optional tools are missing', async () => {
      onPlatform('linux');
      everythingInstalled();
      // The iOS tools are the ones a machine may lack and still be ready.
      machine.onPath = machine.onPath.filter(
        (tool) => !['xtool', 'swift', 'idevice_id', 'idevicesyslog', 'ideviceinfo'].includes(tool)
      );

      await doctor({ fix: true });

      expect(mockedExec).toHaveBeenCalledWith(
        'sudo',
        ['apt', 'install', '-y', 'libimobiledevice-utils'],
        { stdio: 'inherit' }
      );
      expect(logger.info).toHaveBeenCalledWith('Installing optional tools...\n');
      expect(logger.info).toHaveBeenCalledWith('\nOptional tools to install by hand:');
    });

    it('should install with apt what apt can get, and leave the rest as a hint', async () => {
      onPlatform('linux');
      tools('openjdk 11.0.22'); // too old: the JDK is still what is missing

      await doctor({ fix: true });

      expect(mockedExec).toHaveBeenCalledWith(
        'sudo',
        ['apt', 'install', '-y', 'git', 'openjdk-17-jdk', 'libimobiledevice-utils'],
        { stdio: 'inherit' }
      );
      expect(logger.success).toHaveBeenCalledWith(
        '\nInstalled with apt: git openjdk-17-jdk libimobiledevice-utils'
      );
      expect(logger.info).toHaveBeenCalledWith('\nManual installation required for:');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('xtool: Download the latest xtool AppImage')
      );
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('JDK:'));
    });

    it('should install with Homebrew only what Homebrew can get', async () => {
      onPlatform('darwin');
      tools(null);

      await doctor({ fix: true });

      expect(mockedExec).toHaveBeenCalledWith('brew', ['install', 'git'], { stdio: 'inherit' });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('JDK: brew install --cask zulu@17')
      );
      expect(mockedExec).not.toHaveBeenCalledWith('sudo', expect.anything(), expect.anything());
    });

    it('should say how to run the install by hand when it fails', async () => {
      onPlatform('linux');
      tools(null);
      prints('sudo apt install -y git openjdk-17-jdk libimobiledevice-utils', {
        success: false,
        code: 100,
      });

      await doctor({ fix: true });

      expect(logger.error).toHaveBeenCalledWith('\nFailed to install with apt. Run this by hand:');
      expect(logger.info).toHaveBeenCalledWith(
        '  sudo apt install -y git openjdk-17-jdk libimobiledevice-utils'
      );
    });

    it('should only show the hints where it cannot drive a package manager', async () => {
      onPlatform('win32');
      tools(null);

      await doctor({ fix: true });

      expect(logger.warn).toHaveBeenCalledWith('Auto-fix is not supported on this platform.');
      expect(logger.info).toHaveBeenCalledWith('Fix missing dependencies:\n');
      expect(logger.info).toHaveBeenCalledWith('    choco install -y microsoft-openjdk17');
      expect(mockedExec).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['install']),
        expect.anything()
      );
    });

    it('should have nothing to do when everything it could name is there', async () => {
      onPlatform('linux');
      everythingInstalled();

      await doctor({ fix: true });

      expect(logger.success).toHaveBeenCalledWith('\nAll checkable dependencies are installed!');
      expect(mockedExec).not.toHaveBeenCalledWith('sudo', expect.anything(), expect.anything());
    });

    it('should call what is missing optional when only optional tools are', async () => {
      onPlatform('linux');
      everythingInstalled();
      // The iOS tools are the ones a machine may lack and still be ready.
      machine.onPath = machine.onPath.filter((tool) => tool !== 'xtool' && tool !== 'swift');

      // Without --fix: the summary has just called the environment ready.
      await doctor();

      expect(logger.success).toHaveBeenCalledWith('  [✓] Android - Ready to build and run');
      expect(logger.info).toHaveBeenCalledWith('Optional tools:\n');
      expect(logger.info).not.toHaveBeenCalledWith('Fix missing dependencies:\n');
    });
  });
});
