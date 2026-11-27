// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

// The spinner rewrites the terminal line; what it is asked to say is kept instead.
const mockSaid: string[] = [];
jest.mock('ora', () => () => ({
  isSpinning: false,
  start: jest.fn(),
  stop: jest.fn(),
  succeed: (text: string) => mockSaid.push(text),
  fail: (text: string) => mockSaid.push(text),
  warn: (text: string) => mockSaid.push(text),
}));

// Gradle and adb are not run, and no signal reaches a process.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
}));

// adb logcat would keep running.
jest.mock('child_process', () => ({ spawn: jest.fn() }));

import fs from 'fs-extra';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { AndroidRunCommand } from '../commands/run/AndroidRunCommand';
import type { RunCommandOptions } from '../commands/run/AbstractRunCommand';
import { BuildFailedError, PlatformNotFoundError, ToolRequiredError } from '../core/errors';
import type { ExecResult } from '../utils/exec';
import { executeCommand, requireTool } from '../utils/exec';
import { EMOJI, logger } from '../utils/logger';
import { WebServerService } from '../services/web-server.service';
import { silenceLogger } from './helpers/logger';
import { writePluginFixture } from './helpers/plugin';
import { fakeChildProcess, watchRun, type RunEffects } from './helpers/process';
import type { FakeChildProcess } from './helpers/process';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

const DEVICE = 'emulator-5554';
/** Not the address the development profile names (localhost): the one devices can reach. */
const SERVER_URL = 'http://192.168.0.7:3000';
const ADB_HINT = 'Install the Android SDK and add adb to your PATH. Run: gyo doctor';
/** The package gyo create derives from demo-app. */
const PACKAGE = 'com.example.demo_app';
const LAUNCH = `adb -s ${DEVICE} shell am start -n ${PACKAGE}/.MainActivity`;
const LOGCAT_ARGS = ['-s', DEVICE, 'logcat', '-v', 'brief', '-s', 'WebView-Console:*'];
const RUN_OPTIONS: RunCommandOptions = { profile: 'development', device: DEVICE };

/** What the run adds to `process`; taken off after each test. */
let effects: RunEffects;

let project: TestProject;

function execResult(success: boolean, stdout = '', stderr = ''): ExecResult {
  return { success, stdout, stderr, code: success ? 0 : 1 };
}

/** Every command the run executed, as `command arg...`. */
function commandsRun(): string[] {
  return mockedExec.mock.calls.map(([command, args]) => [command, ...(args ?? [])].join(' '));
}

/** `command arg` fails with what it printed; every other command succeeds. */
function failCommand(
  command: string,
  arg: string,
  output: { stdout?: string; stderr?: string }
): void {
  mockedExec.mockImplementation(async (run, args) =>
    run === command && args?.[0] === arg
      ? execResult(false, output.stdout, output.stderr)
      : execResult(true)
  );
}

/** A file of android/, as text. */
function androidFile(...segments: string[]): string {
  return fs.readFileSync(project.android(...segments), 'utf-8');
}

/** What android/app/src/main/assets/gyo-config.json tells the app. */
function appConfig(): unknown {
  return JSON.parse(androidFile('app/src/main/assets/gyo-config.json'));
}

/** Runs the command the way `gyo run` does. */
function startRun(options: RunCommandOptions = RUN_OPTIONS): Promise<void> {
  const command = new AndroidRunCommand();
  command.setOptions(options);
  return command.runDirectly();
}

interface PendingRun {
  run: Promise<void>;
  /** The adb logcat the run follows: the run lasts as long as this process does. */
  logProcess: FakeChildProcess;
}

/**
 * Starts a run and waits until it follows the console of the device, where
 * the run waits for the log process to exit.
 */
async function runUntilLogs(options?: RunCommandOptions): Promise<PendingRun> {
  const logProcess = fakeChildProcess();
  let announceSpawn = (): void => undefined;
  const spawnCalled = new Promise<void>((resolve) => {
    announceSpawn = resolve;
  });
  mockedSpawn.mockImplementation(() => {
    announceSpawn();
    return logProcess as unknown as ChildProcess;
  });

  const run = startRun(options);
  await Promise.race([
    spawnCalled,
    run.then(
      () => {
        throw new Error('The run ended before it followed the console');
      },
      (error: unknown) => {
        throw error;
      }
    ),
  ]);
  return { run, logProcess };
}

/** Ends a run that follows the console: adb logcat exits. */
async function finish({ run, logProcess }: PendingRun): Promise<void> {
  logProcess.emit('exit', 0);
  await run;
}

describe('AndroidRunCommand', () => {
  describe('runDirectly', () => {
    beforeEach(async () => {
      silenceLogger();
      jest.clearAllMocks();
      mockSaid.length = 0;
      mockedExec.mockReset().mockResolvedValue(execResult(true));
      mockedRequireTool.mockReset().mockResolvedValue(undefined);
      mockedSpawn.mockReset();

      // It would start a real dev server.
      jest.spyOn(WebServerService.prototype, 'start').mockResolvedValue({
        process: fakeChildProcess() as unknown as ChildProcess,
        url: SERVER_URL,
      });
      // The launcher watch asks whether the launcher lives; a fake pid must never reach the real call.
      jest.spyOn(process, 'kill').mockImplementation(() => true);
      project = await createTestProject();
      project.setWebApp({ start: 'npm run dev', build: 'npm run build' });

      effects = watchRun();
    });

    afterEach(() => {
      try {
        // What the run put on `process` comes off again, and nothing that was there before.
        effects.restore();
      } finally {
        // Whatever went wrong above, the project and the working directory are left behind by no test.
        jest.restoreAllMocks();
        project?.remove();
      }
    });

    describe('before Gradle runs', () => {
      it('should refuse a project without an android/ directory', async () => {
        fs.removeSync(project.android());

        await expect(startRun()).rejects.toThrow(PlatformNotFoundError);
        expect(commandsRun()).toEqual([]);
      });

      it('should check that adb is installed, pointing at gyo doctor', async () => {
        const pending = await runUntilLogs();

        expect(mockedRequireTool).toHaveBeenCalledWith('adb', ADB_HINT);
        expect(mockedRequireTool.mock.invocationCallOrder[0]).toBeLessThan(
          mockedExec.mock.invocationCallOrder[0]
        );
        await finish(pending);
      });

      it('should stop before Gradle when adb is not installed', async () => {
        mockedRequireTool.mockRejectedValue(new ToolRequiredError('adb', ADB_HINT));

        await expect(startRun()).rejects.toThrow("Required tool 'adb' not found");
        expect(commandsRun()).toEqual([]);
      });

      it('should write the version, version code and name of gyo.config.json into the Android project', async () => {
        await project.setConfig({
          version: '3.15.0',
          displayName: 'Demo App',
          platforms: { android: { enabled: true, versionCode: 73 } },
        });
        let gradleRead = '';
        // What is on disk when Gradle is first asked to build, not what is left after the run.
        mockedExec.mockImplementation(async (command, args) => {
          if (command === './gradlew' && args?.[0] === 'assembleDebug') {
            gradleRead =
              androidFile('app/build.gradle') + androidFile('app/src/main/res/values/strings.xml');
          }
          return execResult(true);
        });

        const pending = await runUntilLogs();

        expect(gradleRead).toContain('versionCode = 73');
        expect(gradleRead).toContain('versionName = "3.15.0"');
        expect(gradleRead).toContain('<string name="app_name">Demo App</string>');
        await finish(pending);
      });

      it('should include the plugins installed in lib/ in the Gradle build', async () => {
        writePluginFixture(
          project.path,
          '@gyo-community/demo-plugin',
          'gyo.plugins.demo.DemoBridge',
          'demo'
        );
        let gradleRead = '';
        // What is on disk when Gradle is first asked to build, not what is left after the run.
        mockedExec.mockImplementation(async (command, args) => {
          if (command === './gradlew' && args?.[0] === 'assembleDebug') {
            gradleRead = androidFile('gyo.settings.gradle') + androidFile('app/gyo.build.gradle');
          }
          return execResult(true);
        });

        const pending = await runUntilLogs();

        expect(gradleRead).toContain("include ':gyo-plugin-demo-plugin'");
        expect(gradleRead).toContain("implementation project(':gyo-plugin-demo-plugin')");
        await finish(pending);
      });

      it('should stop before Gradle when a plugin cannot be synced', async () => {
        // Android sources without a Gradle module file: the app build cannot include them.
        writePluginFixture(
          project.path,
          '@gyo-community/broken',
          'gyo.plugins.broken.BrokenBridge',
          'broken',
          {
            module: false,
          }
        );

        await expect(startRun()).rejects.toThrow(
          '@gyo-community/broken has Android sources but no'
        );
        expect(commandsRun()).toEqual([]);
      });
    });

    describe('the address the app loads', () => {
      it('should be the one the dev server reported, with the webview settings of the project', async () => {
        await project.setConfig({ webview: { allowFileAccess: true, userAgent: 'MyApp/1.0' } });

        const pending = await runUntilLogs();

        expect(appConfig()).toEqual({
          serverUrl: SERVER_URL,
          webview: { allowFileAccess: true, userAgent: 'MyApp/1.0' },
        });
        expect(logger.success).toHaveBeenCalledWith(`App is connected to: ${SERVER_URL}`);
        await finish(pending);
      });

      it("should be the profile's serverUrl for a profile that is not development", async () => {
        await project.setConfig({
          profiles: { staging: { serverUrl: 'https://staging.example.com' } },
        });

        const pending = await runUntilLogs({ profile: 'staging', device: DEVICE });

        expect(WebServerService.prototype.start).not.toHaveBeenCalled();
        expect(appConfig()).toEqual({
          serverUrl: 'https://staging.example.com',
          webview: { allowFileAccess: false, allowUniversalAccessFromFileURLs: false },
        });
        expect(mockSaid).toContain('Using staging profile: https://staging.example.com');
        await finish(pending);
      });
    });

    describe('build', () => {
      it('should run ./gradlew assembleDebug in android/', async () => {
        const pending = await runUntilLogs();

        expect(mockedExec).toHaveBeenCalledWith('./gradlew', ['assembleDebug'], {
          cwd: project.android(),
          stdio: 'pipe',
        });
        await finish(pending);
      });

      it.each([
        ['stderr', { stderr: 'FAILURE: Build failed with an exception.' }],
        ['stdout', { stdout: 'FAILURE: Build failed with an exception.' }],
      ] as Array<[string, { stdout?: string; stderr?: string }]>)(
        'should stop the run with BuildFailedError and report what Gradle printed to %s',
        async (_stream, output) => {
          failCommand('./gradlew', 'assembleDebug', output);

          const run = startRun();
          await expect(run).rejects.toThrow(BuildFailedError);
          await expect(run).rejects.toThrow('Android build failed');

          expect(logger.error).toHaveBeenCalledWith('FAILURE: Build failed with an exception.');
          expect(commandsRun()).toEqual(['./gradlew assembleDebug']);
        }
      );

      it('should say how to point Gradle at the SDK when Gradle cannot find it', async () => {
        failCommand('./gradlew', 'assembleDebug', {
          stderr:
            'SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable',
        });

        await expect(startRun()).rejects.toThrow('Android build failed');

        expect(logger.error).toHaveBeenCalledWith(
          'Set ANDROID_HOME or create android/local.properties with sdk.dir=<path>'
        );
        expect(logger.info).toHaveBeenCalledWith("Run 'gyo doctor' to check your environment.");
      });
    });

    describe('install', () => {
      it('should run ./gradlew installDebug in android/ once the app is built', async () => {
        const pending = await runUntilLogs();

        expect(mockedExec).toHaveBeenCalledWith('./gradlew', ['installDebug'], {
          cwd: project.android(),
          stdio: 'pipe',
        });
        expect(commandsRun()).toEqual([
          './gradlew assembleDebug',
          './gradlew installDebug',
          LAUNCH,
        ]);
        await finish(pending);
      });

      it('should stop the run with BuildFailedError and report what Gradle printed when the install fails', async () => {
        failCommand('./gradlew', 'installDebug', { stderr: 'Installation did not succeed.' });

        const run = startRun();
        await expect(run).rejects.toThrow(BuildFailedError);
        await expect(run).rejects.toThrow('Failed to install app');

        expect(logger.error).toHaveBeenCalledWith('Installation did not succeed.');
        expect(commandsRun()).toEqual(['./gradlew assembleDebug', './gradlew installDebug']);
      });
    });

    describe('launch', () => {
      it('should read the applicationId the template writes, assignment and all', async () => {
        // A regression test: the build file of a generated project, not one written for the test.
        const pending = await runUntilLogs();

        expect(commandsRun()).toContain(LAUNCH);
        expect(mockSaid).toContain('App installed and launched on Android device!');
        await finish(pending);
      });

      it('should read the applicationId "..." of a project made by an earlier gyo', async () => {
        fs.writeFileSync(
          project.android('app/build.gradle'),
          androidFile('app/build.gradle').replace(
            `applicationId = "${PACKAGE}"`,
            'applicationId "com.example.legacy"'
          )
        );

        const pending = await runUntilLogs();

        expect(commandsRun()).toContain(
          `adb -s ${DEVICE} shell am start -n com.example.legacy/.MainActivity`
        );
        await finish(pending);
      });

      it('should report a launch that failed, and go on to the console', async () => {
        failCommand('adb', '-s', {});

        const pending = await runUntilLogs();

        expect(logger.warn).toHaveBeenCalledWith(
          'Could not auto-launch app. Please launch manually.'
        );
        expect(mockSaid).toContain('App installed on Android device!');
        await finish(pending);
      });

      it('should say the app was installed, and launch nothing, when build.gradle has no applicationId', async () => {
        fs.writeFileSync(
          project.android('app/build.gradle'),
          androidFile('app/build.gradle').replace(/^\s*applicationId.*\n/m, '')
        );

        const pending = await runUntilLogs();

        expect(commandsRun()).toEqual(['./gradlew assembleDebug', './gradlew installDebug']);
        expect(mockSaid).toContain('App installed on Android device!');
        await finish(pending);
      });

      it('should warn that auto-launch may not work when build.gradle cannot be read', async () => {
        // The identity of the app is written to that file before Gradle runs, so it can
        // only become unreadable while Gradle installs. A directory in place of the file
        // makes reading it fail, whoever runs the test.
        mockedExec.mockImplementation(async (command, args) => {
          if (command === './gradlew' && args?.[0] === 'installDebug') {
            fs.removeSync(project.android('app/build.gradle'));
            fs.mkdirSync(project.android('app/build.gradle'));
          }
          return execResult(true);
        });

        const pending = await runUntilLogs();

        expect(logger.warn).toHaveBeenCalledWith(
          'Auto-launch may not work. Launch the app manually on your device.'
        );
        expect(commandsRun()).toEqual(['./gradlew assembleDebug', './gradlew installDebug']);
        await finish(pending);
      });
    });

    describe('logs', () => {
      it('should follow the console of the device', async () => {
        const pending = await runUntilLogs();

        expect(mockedSpawn).toHaveBeenCalledWith('adb', LOGCAT_ARGS, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        await finish(pending);
      });

      it('should report what adb logcat prints, one line per message', async () => {
        const info = logger.info as jest.MockedFunction<typeof logger.info>;
        const pending = await runUntilLogs();
        const reportedBefore = info.mock.calls.length;

        // Two messages in one chunk, the first as logcat -v brief prints it, with empty lines around.
        pending.logProcess.stdout.emit(
          'data',
          Buffer.from(
            '\nI/WebView-Console( 4321): App ready -- From line 12 of http://192.168.0.7:3000/app.js\n' +
              '\n--------- beginning of main\n'
          )
        );

        // What the page logged, without the tag, the process and where the line came from.
        expect(info.mock.calls.slice(reportedBefore).map(([message]) => message)).toEqual([
          `${EMOJI.PHONE} App ready`,
          expect.stringContaining('--------- beginning of main'),
        ]);
        await finish(pending);
      });

      it('should report what adb logcat prints to stderr as a warning', async () => {
        const pending = await runUntilLogs();

        pending.logProcess.stderr.emit('data', Buffer.from('adb: device offline\n'));

        expect(logger.warn).toHaveBeenCalledWith('adb: device offline');
        await finish(pending);
      });

      it('should end when the log process exits', async () => {
        const pending = await runUntilLogs();
        let ended = false;
        pending.run.then(() => {
          ended = true;
        });
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(ended).toBe(false);

        await finish(pending);

        expect(ended).toBe(true);
      });

      it('should fail the run, and stop the log process, when adb logcat fails', async () => {
        const pending = await runUntilLogs();

        pending.logProcess.emit('error', new Error('spawn adb EACCES'));

        await expect(pending.run).rejects.toThrow('spawn adb EACCES');
        expect(pending.logProcess.kill).toHaveBeenCalledWith('SIGTERM');
      });
    });
  });
});
