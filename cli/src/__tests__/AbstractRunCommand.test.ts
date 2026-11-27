// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));
// ESM-only
jest.mock('inquirer', () => ({ prompt: jest.fn(), default: { prompt: jest.fn() } }));
jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// A signal the CLI sends reaches a real process group, so a fake pid must never get there.
jest.mock('../utils/exec', () => ({ signalProcessTree: jest.fn() }));
// The log process the platform part starts.
jest.mock('child_process', () => ({ spawn: jest.fn() }));

import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import type { CommandMeta } from '../commands/base';
import { AbstractRunCommand } from '../commands/run/AbstractRunCommand';
import { DEFAULT_PORT, PARENT_WATCH_INTERVAL_MS, PROCESS_KILL_TIMEOUT_MS } from '../core/constants';
import { GyoError, ServerStartError } from '../core/errors';
import { WebServerService } from '../services/web-server.service';
import { signalProcessTree } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import {
  fakeChildProcess,
  watchRun,
  type FakeChildProcess,
  type RunEffects,
} from './helpers/process';
import { createTestProject, type TestProject } from './helpers/project';

/** Where the dev server answers, as the run learns it from WebServerService. */
const SERVER_URL = 'http://192.168.1.5:3000';
/** A promise that is resolved by hand. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Stands in for the platform part of a run, the way AndroidRunCommand writes
 * it: the platform directory is checked, the user is told the app is
 * connected, and the log process is followed until it ends. It records what
 * the base class hands it.
 */
class RecordingRunCommand extends AbstractRunCommand {
  /** The server URL of each run, in order. */
  public readonly serverUrls: string[] = [];
  /** Resolves once the log process is running, which is where a run waits. */
  public readonly following = deferred();

  getMeta(): CommandMeta {
    return { name: 'test-run', description: 'Runs nothing' };
  }

  protected async runPlatform(serverUrl: string): Promise<void> {
    this.serverUrls.push(serverUrl);
    await this.checkPlatformDirectoryExists();
    this.showSuccessMessage(serverUrl);
    await this.monitorLogs('device-1');
  }

  protected monitorLogs(_identifier: string): Promise<void> {
    this.platformProcess = spawn('adb', ['logcat'], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.following.resolve();
    return this.followLogProcess(this.platformProcess, (line) => logger.info(line));
  }
}

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedSignal = signalProcessTree as jest.MockedFunction<typeof signalProcessTree>;

describe('AbstractRunCommand', () => {
  let project: TestProject;
  let command: RecordingRunCommand;
  /** The run of the current test, in progress. */
  let run: Promise<void>;
  let mockedStart: jest.SpiedFunction<WebServerService['start']>;
  let devServer: FakeChildProcess;
  let logProcess: FakeChildProcess;
  /** Resolves when the CLI first signals a process it started. */
  let signalled: Promise<void>;
  /** The listeners on `process` before the run, by event. */
  /** What the run adds to `process`, taken off after the test. */
  let effects: RunEffects;

  /** Runs the command until the log process is running, which is where a run waits. */
  async function startRun(): Promise<void> {
    run = command.runDirectly();
    await Promise.race([
      command.following.promise,
      run.then(() => {
        throw new Error('The run ended before the log process was running');
      }),
    ]);
  }

  /** Ends the waiting run the way the log process ending does. */
  async function endRun(): Promise<void> {
    logProcess.emit('exit', 0);
    await run;
  }

  /** What a run rejects with. */
  function failureOf(pending: Promise<unknown>): Promise<unknown> {
    return pending.catch((error: unknown) => error);
  }

  /** How `process.kill(pid, 0)` answers for the launcher: alive, or an error code. */
  function launcherAnswers(code?: 'EPERM' | 'ESRCH'): void {
    jest.mocked(process.kill).mockImplementation((_pid, signal) => {
      if (signal === 0 && code) {
        throw Object.assign(new Error(`kill ${code}`), { code });
      }
      return true;
    });
  }

  beforeEach(async () => {
    silenceLogger();
    jest.clearAllMocks();
    mockedSpawn.mockReset();
    mockedSignal.mockReset();

    project = await createTestProject();
    devServer = fakeChildProcess(1001);
    logProcess = fakeChildProcess(1002);

    // The run watches its launcher on an interval; with fake timers none is left behind.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(process, 'kill').mockReturnValue(true);
    // Starts a real dev server otherwise.
    mockedStart = jest.spyOn(WebServerService.prototype, 'start').mockResolvedValue({
      process: devServer as unknown as ChildProcess,
      url: SERVER_URL,
    });
    mockedSpawn.mockReturnValue(logProcess as unknown as ChildProcess);
    signalled = new Promise<void>((resolve) => mockedSignal.mockImplementation(() => resolve()));

    command = new RecordingRunCommand();
    command.setPlatform('android');
    command.setOptions({ profile: 'development' });
    effects = watchRun();
  });

  afterEach(() => {
    effects.restore();
    jest.useRealTimers();
    jest.restoreAllMocks();
    project.remove();
  });

  describe('the local web server', () => {
    beforeEach(() => {
      project.setWebApp({ start: 'npm run dev' });
    });

    it('should start it in lib/ with the start command, the port and the paths to clean up', async () => {
      await project.setConfig({
        script: { start: 'npm run dev', preStartCleanup: ['.next', 'dist'] },
      });

      await startRun();

      expect(mockedStart).toHaveBeenCalledWith({
        webPath: project.lib(),
        port: DEFAULT_PORT,
        startCommand: 'npm run dev',
        preStartCleanup: ['.next', 'dist'],
        advertiseHost: undefined,
      });
      await endRun();
    });

    it('should trim the start command', async () => {
      await project.setConfig({ script: { start: '  npm run dev  ' } });

      await startRun();

      expect(mockedStart).toHaveBeenCalledWith(
        expect.objectContaining({ startCommand: 'npm run dev' })
      );
      await endRun();
    });

    it.each([
      ['left out', {}],
      ['blank', { start: '   ' }],
    ])(
      'should refuse to run when script.start is %s, and say where to set it',
      async (_case, script) => {
        await project.setConfig({ script });

        const failure = await failureOf(command.runDirectly());

        expect(failure).toBeInstanceOf(ServerStartError);
        expect(failure).toHaveProperty(
          'message',
          expect.stringContaining(
            "Start command is not configured. Please set 'script.start' in gyo.config.json"
          )
        );
        expect(mockedStart).not.toHaveBeenCalled();
      }
    );

    it.each([
      { serverUrl: 'http://localhost:8080', port: 8080 },
      { serverUrl: 'https://example.com', port: DEFAULT_PORT },
      { serverUrl: 'http://', port: DEFAULT_PORT },
    ])(
      'should ask for port $port when the profile’s serverUrl is $serverUrl',
      async ({ serverUrl, port }) => {
        await project.setConfig({ profiles: { development: { serverUrl } } });

        await startRun();

        expect(mockedStart).toHaveBeenCalledWith(expect.objectContaining({ port }));
        await endRun();
      }
    );

    it('should warn when the profile’s serverUrl cannot be parsed', async () => {
      await project.setConfig({ profiles: { development: { serverUrl: 'http://' } } });

      await startRun();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /Failed to parse URL from profile 'development', using default port 3000: .+/
        )
      );
      await endRun();
    });

    it.each([
      ['an empty profiles object', {}],
      ['no profiles object', undefined],
    ])('should ask for the default port when the config has %s', async (_case, profiles) => {
      // JSON drops an undefined value, which removes `profiles` altogether.
      await project.setConfig({ profiles });

      await startRun();

      expect(mockedStart).toHaveBeenCalledWith(expect.objectContaining({ port: DEFAULT_PORT }));
      await endRun();
    });

    it('should let --port win over the profile', async () => {
      await project.setConfig({
        profiles: { development: { serverUrl: 'http://localhost:8080' } },
      });
      command.setOptions({ profile: 'development', port: 5173 });

      await startRun();

      expect(mockedStart).toHaveBeenCalledWith(expect.objectContaining({ port: 5173 }));
      await endRun();
    });

    it('should advertise the machine the profile names', async () => {
      await project.setConfig({
        profiles: { development: { serverUrl: 'http://192.168.0.7:3000' } },
      });

      await startRun();

      expect(mockedStart).toHaveBeenCalledWith(
        expect.objectContaining({ advertiseHost: '192.168.0.7' })
      );
      await endRun();
    });

    it('should leave the address to this machine when the profile says localhost', async () => {
      await startRun();

      expect(mockedStart).toHaveBeenCalledWith(
        expect.objectContaining({ advertiseHost: undefined })
      );
      await endRun();
    });

    it('should tell the user when the dev server stops unexpectedly, and keep the app running', async () => {
      await startRun();

      devServer.emit('exit', 1);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Web server unexpectedly stopped with code 1')
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Check if another development server is running or if there are any errors above.'
      );
      expect(logger.info).toHaveBeenCalledWith(
        'The app will continue running but may not be able to connect to the server.'
      );
      await endRun();
    });

    it('should say nothing when the dev server stops cleanly', async () => {
      await startRun();

      devServer.emit('exit', 0);

      expect(logger.error).not.toHaveBeenCalled();
      await endRun();
    });
  });

  describe('lib/', () => {
    it('should refuse a project without lib/ before anything is started, and say what to run', async () => {
      fs.removeSync(project.lib());

      const failure = await failureOf(command.runDirectly());

      expect(failure).toBeInstanceOf(ServerStartError);
      expect(failure).toHaveProperty(
        'message',
        expect.stringContaining(`'lib/' directory not found in ${project.path}.`)
      );
      expect(failure).toHaveProperty(
        'message',
        expect.stringContaining("Run 'gyo create <project-name>' to scaffold a project")
      );
      expect(mockedStart).not.toHaveBeenCalled();
    });

    it('should refuse a project whose lib/ has no package.json before anything is started', async () => {
      // `gyo create` leaves lib/ empty.
      const failure = await failureOf(command.runDirectly());

      expect(failure).toBeInstanceOf(ServerStartError);
      expect(failure).toHaveProperty(
        'message',
        expect.stringContaining("'lib/package.json' not found.\n  Run 'gyo create <project-name>'")
      );
      expect(mockedStart).not.toHaveBeenCalled();
    });
  });

  describe('another profile', () => {
    it('should give the platform part the profile’s serverUrl and start no local server', async () => {
      await project.setConfig({
        profiles: { production: { serverUrl: 'https://app.example.com' } },
      });
      command.setOptions({ profile: 'production' });

      await startRun();

      expect(command.serverUrls).toEqual(['https://app.example.com']);
      expect(mockedStart).not.toHaveBeenCalled();
      await endRun();
    });

    it('should refuse a profile the config does not define and name those it does', async () => {
      await project.setConfig({
        profiles: {
          development: { serverUrl: 'http://localhost:3000' },
          production: { serverUrl: 'https://app.example.com' },
        },
      });
      command.setOptions({ profile: 'staging' });

      const failure = await failureOf(command.runDirectly());

      expect(failure).toBeInstanceOf(GyoError);
      expect(failure).toHaveProperty(
        'message',
        "Profile 'staging' not found in gyo.config.json. Available profiles: development, production"
      );
      expect(mockedStart).not.toHaveBeenCalled();
    });

    it('should refuse a profile when the config has none, and say so', async () => {
      await project.setConfig({ profiles: {} });
      command.setOptions({ profile: 'staging' });

      const failure = await failureOf(command.runDirectly());

      expect(failure).toHaveProperty(
        'message',
        "Profile 'staging' not found in gyo.config.json. No profiles configured"
      );
    });
  });

  describe('the success message', () => {
    it('should name the server URL and how to stop', async () => {
      project.setWebApp({ start: 'npm run dev' });

      await startRun();

      expect(logger.success).toHaveBeenCalledWith(`App is connected to: ${SERVER_URL}`);
      expect(logger.info).toHaveBeenCalledWith('Monitoring console logs (Press Ctrl+C to stop)...');
      await endRun();
    });
  });

  describe('the platform process', () => {
    beforeEach(() => {
      project.setWebApp({ start: 'npm run dev' });
    });

    it('should stop the platform process when the platform part ends', async () => {
      await startRun();

      await endRun();

      expect(logProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should stop the platform process when the platform part throws', async () => {
      await startRun();
      const error = new Error('adb: device offline');

      logProcess.emit('error', error);
      // Before the error goes on, the run asks the dev server to stop.
      await signalled;
      devServer.emit('exit', 0);

      await expect(run).rejects.toBe(error);
      expect(logProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it.each([
      ['was asked to stop already', { killed: true }],
      ['never started and has no pid', { pid: undefined }],
    ])('should leave alone a platform process that %s', async (_case, state) => {
      Object.assign(logProcess, state);

      await startRun();
      await endRun();

      expect(logProcess.kill).not.toHaveBeenCalled();
    });

    it('should still end the run when the platform process cannot be stopped', async () => {
      jest.spyOn(logProcess, 'kill').mockImplementation(() => {
        throw new Error('EPERM: operation not permitted');
      });

      await startRun();
      await endRun();

      expect(logger.debug).toHaveBeenCalledWith(
        'Failed to kill platform process: EPERM: operation not permitted'
      );
    });

    it('should warn when the log process stops on its own, and end the run', async () => {
      await startRun();

      logProcess.emit('exit', 1);

      await run;
      expect(logger.warn).toHaveBeenCalledWith('Log monitoring stopped');
    });
  });

  describe('signals', () => {
    beforeEach(() => {
      project.setWebApp({ start: 'npm run dev' });
    });

    it.each(['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const)(
      'should stop the dev server and the log process and exit on %s',
      async (signal) => {
        await startRun();

        effects.emit(signal);

        expect(mockedSignal).toHaveBeenCalledWith(devServer, 'SIGKILL');
        expect(mockedSignal).toHaveBeenCalledWith(logProcess, 'SIGKILL');
        expect(process.exit).toHaveBeenCalledWith(0);
        expect(jest.getTimerCount()).toBe(0);
        await endRun();
      }
    );

    it('should stop the dev server and the log process when the process exits, as after a crash', async () => {
      await startRun();

      effects.emit('exit');

      expect(mockedSignal).toHaveBeenCalledWith(devServer, 'SIGKILL');
      expect(mockedSignal).toHaveBeenCalledWith(logProcess, 'SIGKILL');
      await endRun();
    });
  });

  describe('the launcher watch', () => {
    beforeEach(() => {
      project.setWebApp({ start: 'npm run dev' });
    });

    it.each([
      ['alive', undefined],
      ['alive but not its own to signal', 'EPERM'],
    ] as const)('should keep running while the launcher is %s', async (_case, code) => {
      launcherAnswers(code);

      await startRun();
      jest.advanceTimersByTime(PARENT_WATCH_INTERVAL_MS * 3);

      expect(process.exit).not.toHaveBeenCalled();
      expect(mockedSignal).not.toHaveBeenCalled();
      await endRun();
    });

    it('should probe the launcher every PARENT_WATCH_INTERVAL_MS', async () => {
      await startRun();

      jest.advanceTimersByTime(PARENT_WATCH_INTERVAL_MS - 1);
      expect(process.kill).not.toHaveBeenCalled();

      jest.advanceTimersByTime(PARENT_WATCH_INTERVAL_MS);
      expect(process.kill).toHaveBeenCalledTimes(1);
      expect(process.kill).toHaveBeenCalledWith(process.ppid, 0);
      await endRun();
    });

    it('should stop everything and exit once the launcher is gone', async () => {
      launcherAnswers('ESRCH');

      await startRun();
      jest.advanceTimersByTime(PARENT_WATCH_INTERVAL_MS);

      expect(mockedSignal).toHaveBeenCalledWith(devServer, 'SIGKILL');
      expect(mockedSignal).toHaveBeenCalledWith(logProcess, 'SIGKILL');
      expect(process.exit).toHaveBeenCalledWith(0);
      expect(jest.getTimerCount()).toBe(0);
      await endRun();
    });
  });

  // `execute()` is the entry point that reports an error: it is where handleError,
  // which stops the processes first, is reached.
  describe('stopping with a timeout', () => {
    function runAndReport(): Promise<unknown> {
      return failureOf(command.execute());
    }

    // `gyo run` runs the command of a platform with `runDirectly()` and
    // reports the error itself: the dev server has to be stopped before it.
    it('should ask the dev server to stop when the platform part fails, as gyo run calls it', async () => {
      const failure = failureOf(command.runDirectly());
      await signalled;

      expect(mockedSignal).toHaveBeenCalledWith(devServer, 'SIGTERM');

      jest.advanceTimersByTime(PROCESS_KILL_TIMEOUT_MS);

      expect(await failure).toHaveProperty(
        'message',
        expect.stringContaining("Platform 'android' not found")
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should not report a dev server as stopped unexpectedly while the run is stopping it', async () => {
      const failure = failureOf(command.runDirectly());
      await signalled;
      devServer.emit('exit', 143); // what npm exits with on SIGTERM
      await failure;

      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Web server unexpectedly stopped')
      );
    });

    beforeEach(() => {
      project.setWebApp({ start: 'npm run dev' });
      // The platform part fails once the dev server runs.
      fs.removeSync(project.android());
    });

    it('should ask the dev server to stop and kill it once it has not exited after PROCESS_KILL_TIMEOUT_MS', async () => {
      const failure = runAndReport();
      await signalled;

      expect(mockedSignal).toHaveBeenCalledWith(devServer, 'SIGTERM');

      jest.advanceTimersByTime(PROCESS_KILL_TIMEOUT_MS - 1);
      expect(mockedSignal).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      expect(mockedSignal).toHaveBeenNthCalledWith(2, devServer, 'SIGKILL');
      await failure;
    });

    it('should let a dev server that stops when asked go without a kill', async () => {
      const failure = runAndReport();
      await signalled;

      devServer.emit('exit', 0);
      await failure;
      jest.advanceTimersByTime(PROCESS_KILL_TIMEOUT_MS);

      expect(mockedSignal).toHaveBeenCalledTimes(1);
      expect(mockedSignal).toHaveBeenCalledWith(devServer, 'SIGTERM');
    });

    it('should report the error once, after the dev server has stopped', async () => {
      const failure = runAndReport();
      await signalled;

      expect(logger.error).not.toHaveBeenCalled();

      jest.advanceTimersByTime(PROCESS_KILL_TIMEOUT_MS);

      expect(await failure).toHaveProperty(
        'message',
        expect.stringContaining("Platform 'android' not found")
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Platform 'android' not found")
      );
    });
  });

  describe('handleError', () => {
    beforeEach(() => {
      project.setWebApp({ start: 'npm run dev' });
    });

    it.each([
      ['an Error', new Error('dev server is gone')],
      ['a value that is not an Error', 'dev server is gone'],
    ])('should wrap %s in a GyoError that keeps it as the cause', async (_case, cause) => {
      mockedStart.mockRejectedValueOnce(cause);

      const failure = await failureOf(command.execute());

      expect(failure).toBeInstanceOf(GyoError);
      expect(failure).toMatchObject({ message: 'dev server is gone', cause });
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('dev server is gone');
    });

    it('should throw a GyoError again as it is', async () => {
      const error = new ServerStartError('Port 3000 is already in use');
      mockedStart.mockRejectedValueOnce(error);

      const failure = await failureOf(command.execute());

      expect(failure).toBe(error);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should log the stack of the error it reports', async () => {
      mockedStart.mockRejectedValueOnce(new Error('dev server is gone'));

      await failureOf(command.execute());

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^Error: dev server is gone\n\s+at /)
      );
    });
  });

  describe('the platform', () => {
    it('should refuse a platform it cannot run and name those it can', async () => {
      command.setPositionalArgs(['web']);

      await expect(command.runDirectly()).rejects.toThrow('Valid platforms are: android, ios');
    });
  });
});
