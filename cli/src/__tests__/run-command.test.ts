// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));
// ESM-only
jest.mock('inquirer', () => ({ prompt: jest.fn(), default: { prompt: jest.fn() } }));
jest.mock('ora', () => () => ({
  isSpinning: false,
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// Finding the devices runs adb and idevice_id on this machine.
jest.mock('../services/device.service', () => ({ getAllDevices: jest.fn() }));

// The commands of a platform would run Gradle, adb, xtool and which.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
}));

// adb logcat would keep running.
jest.mock('child_process', () => ({ spawn: jest.fn() }));

import fs from 'fs-extra';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import inquirer from 'inquirer';
import { RunCommand } from '../commands/run';
import type { Device } from '../services/device.service';
import { getAllDevices } from '../services/device.service';
import { GyoError } from '../core/errors';
import type { ExecResult } from '../utils/exec';
import { checkCommandExists, executeCommand, requireTool } from '../utils/exec';
import { logger } from '../utils/logger';
import { WebServerService } from '../services/web-server.service';
import { silenceLogger } from './helpers/logger';
import { fakeChildProcess, watchRun, type RunEffects } from './helpers/process';
import type { FakeChildProcess } from './helpers/process';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

const mockedGetAllDevices = getAllDevices as jest.MockedFunction<typeof getAllDevices>;
const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheckCommandExists = checkCommandExists as jest.MockedFunction<
  typeof checkCommandExists
>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

const ANDROID: Device = {
  platform: 'android',
  id: 'emulator-5554',
  name: 'Pixel 7',
  state: 'Available',
};
const IOS: Device = { platform: 'ios', id: 'abc123', name: 'iPhone 15 Pro', state: 'Available' };

/** What the dev server reports: another address than the one the profile names. */
const SERVER_URL = 'http://192.168.0.7:3000';
/** What the Android command runs to start the app it installed. */
const LAUNCH = 'adb -s emulator-5554 shell am start -n com.example.demo_app/.MainActivity';

/** What the run adds to `process`; taken off after each test. */
let effects: RunEffects;

let project: TestProject;

function execResult(success: boolean): ExecResult {
  return { success, stdout: '', stderr: '', code: success ? 0 : 1 };
}

/** Every command a run executed, as `command arg...`. */
function commandsRun(): string[] {
  return mockedExec.mock.calls.map(([command, args]) => [command, ...(args ?? [])].join(' '));
}

/** What the command of a platform wrote as the address the app loads. */
function appConfig(platform: 'android' | 'ios'): unknown {
  const file =
    platform === 'android'
      ? project.android('app/src/main/assets/gyo-config.json')
      : project.ios('Sources/Resources/gyo-config.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** Runs `gyo run` as the command line hands it its options. */
function gyoRun(options: { profile: string; device?: string; port?: number }): Promise<void> {
  const command = new RunCommand();
  command.setOptions(options);
  return command.execute();
}

/** Fails when anything of a platform command ran: a dev server, a command, a process. */
function expectNoPlatformCommandToHaveRun(): void {
  expect(WebServerService.prototype.start).not.toHaveBeenCalled();
  expect(mockedExec).not.toHaveBeenCalled();
  expect(mockedSpawn).not.toHaveBeenCalled();
}

interface PendingRun {
  run: Promise<void>;
  /** The adb logcat the run follows: the run lasts as long as this process does. */
  logProcess: FakeChildProcess;
}

/**
 * Runs `gyo run` on an Android device and waits until its command follows
 * the console, where the run waits for the log process to exit.
 */
async function runUntilLogs(options: { profile: string }): Promise<PendingRun> {
  const logProcess = fakeChildProcess();
  let announceSpawn = (): void => undefined;
  const spawnCalled = new Promise<void>((resolve) => {
    announceSpawn = resolve;
  });
  mockedSpawn.mockImplementation(() => {
    announceSpawn();
    return logProcess as unknown as ChildProcess;
  });

  const run = gyoRun(options);
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

describe('RunCommand', () => {
  describe('execute', () => {
    beforeEach(async () => {
      silenceLogger();
      jest.clearAllMocks();
      mockedGetAllDevices.mockReset();
      mockedExec.mockReset().mockResolvedValue(execResult(true));
      mockedCheckCommandExists.mockReset().mockResolvedValue(false);
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

    describe('finding a device', () => {
      it('should say how to get a device, and fail before any platform command runs, when none is connected', async () => {
        mockedGetAllDevices.mockResolvedValue([]);

        const run = gyoRun({ profile: 'development' });
        await expect(run).rejects.toThrow(GyoError);
        await expect(run).rejects.toThrow('No devices found');

        expect(logger.error).toHaveBeenCalledWith('Please connect a device or start an emulator');
        expect(logger.info).toHaveBeenCalledWith('Troubleshooting:');
        expectNoPlatformCommandToHaveRun();
      });

      it('should list the connected devices when the one asked for is not among them', async () => {
        mockedGetAllDevices.mockResolvedValue([ANDROID, IOS]);

        const run = gyoRun({ profile: 'development', device: 'nonexistent' });
        await expect(run).rejects.toThrow(GyoError);
        await expect(run).rejects.toThrow("Device 'nonexistent' not found");

        expect(logger.error).toHaveBeenCalledWith("Device 'nonexistent' not found");
        expect(logger.error).toHaveBeenCalledWith('Available devices:');
        expect(logger.info).toHaveBeenCalledWith('  - android: Pixel 7 (emulator-5554)');
        expect(logger.info).toHaveBeenCalledWith('  - ios: iPhone 15 Pro (abc123)');
        expectNoPlatformCommandToHaveRun();
      });
    });

    describe('choosing a device', () => {
      it('should run on the device that was asked for', async () => {
        mockedGetAllDevices.mockResolvedValue([ANDROID, IOS]);
        // Only the directory of the device's platform has to be there.
        fs.removeSync(project.android());

        await gyoRun({ profile: 'development', device: IOS.id });

        expect(logger.info).toHaveBeenCalledWith('Using specified device: iPhone 15 Pro (ios)');
        expect(mockedPrompt).not.toHaveBeenCalled();
        expect(mockedExec).toHaveBeenCalledWith('xtool', ['dev', '--udid', IOS.id], {
          cwd: project.ios(),
          stdio: 'pipe',
        });
        expect(commandsRun()).toEqual([`xtool dev --udid ${IOS.id}`]);
        expect(appConfig('ios')).toEqual({ serverUrl: SERVER_URL });
      });

      it('should run on the only device without asking', async () => {
        mockedGetAllDevices.mockResolvedValue([ANDROID]);
        // Only the directory of the device's platform has to be there.
        fs.removeSync(project.ios());

        const pending = await runUntilLogs({ profile: 'development' });

        expect(mockedPrompt).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          "Found 1 device. Automatically selecting 'Pixel 7' (android)"
        );
        expect(commandsRun()).toEqual([
          './gradlew assembleDebug',
          './gradlew installDebug',
          LAUNCH,
        ]);
        expect(appConfig('android')).toEqual({
          serverUrl: SERVER_URL,
          webview: { allowFileAccess: false, allowUniversalAccessFromFileURLs: false },
        });
        await finish(pending);
      });

      it('should ask which device to run on when several are connected, and run on the one chosen', async () => {
        mockedGetAllDevices.mockResolvedValue([ANDROID, IOS]);
        mockedPrompt.mockResolvedValue({ deviceIndex: 1 });

        await gyoRun({ profile: 'development' });

        expect(mockedPrompt).toHaveBeenCalledWith([
          {
            type: 'select',
            name: 'deviceIndex',
            message: 'Select a device:',
            choices: [
              { name: '[ANDROID] Pixel 7 (emulator-5554)', value: 0 },
              { name: '[IOS] iPhone 15 Pro (abc123)', value: 1 },
            ],
          },
        ]);
        expect(commandsRun()).toEqual([`xtool dev --udid ${IOS.id}`]);
        expect(appConfig('ios')).toEqual({ serverUrl: SERVER_URL });
        expect(fs.pathExistsSync(project.android('app/src/main/assets/gyo-config.json'))).toBe(
          false
        );
      });
    });

    describe('the command of the platform', () => {
      it('should receive the port of the run', async () => {
        mockedGetAllDevices.mockResolvedValue([IOS]);

        await gyoRun({ profile: 'development', device: IOS.id, port: 4100 });

        expect(WebServerService.prototype.start).toHaveBeenCalledWith(
          expect.objectContaining({
            port: 4100,
            webPath: project.lib(),
            startCommand: 'npm run dev',
          })
        );
      });

      it('should receive the profile of the run', async () => {
        mockedGetAllDevices.mockResolvedValue([IOS]);
        await project.setConfig({
          profiles: { staging: { serverUrl: 'https://staging.example.com' } },
        });

        await gyoRun({ profile: 'staging', device: IOS.id });

        expect(WebServerService.prototype.start).not.toHaveBeenCalled();
        expect(appConfig('ios')).toEqual({ serverUrl: 'https://staging.example.com' });
      });
    });
  });
});
