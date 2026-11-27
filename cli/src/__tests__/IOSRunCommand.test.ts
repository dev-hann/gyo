// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

// The spinner writes to the terminal.
jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// Every command the CLI runs leaves the process, and signalProcessTree signals a real process group.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
}));

// Every process the CLI starts would be real: each spawn hands over a fake instead.
jest.mock('child_process', () => ({ spawn: jest.fn() }));

import type { EventEmitter } from 'events';
import fs from 'fs-extra';
import type { ChildProcess, SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import { IOSRunCommand } from '../commands/run/IOSRunCommand';
import { BuildFailedError, PlatformNotFoundError, ToolRequiredError } from '../core/errors';
import { WebServerService } from '../services/web-server.service';
import { checkCommandExists, executeCommand, requireTool } from '../utils/exec';
import type { ExecResult } from '../utils/exec';
import { EMOJI, logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { fakeChildProcess } from './helpers/process';
import type { FakeChildProcess } from './helpers/process';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

const SERVER_URL = 'http://192.168.1.7:3000';
/** The project `demo-app` in the template's `bundleID: {{PACKAGE_NAME}}`. */
const BUNDLE_ID = 'com.example.demo_app';
/** The ID xtool gives an app it signs for a device. */
const FULL_BUNDLE_ID = `XTL-ABC123.${BUNDLE_ID}`;
const XTOOL_HINT = 'Install xtool: https://xtool.sh';
const LOG_PROCESS_OPTIONS: SpawnOptions = {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
};
const SEARCH_PROCESS_OPTIONS: SpawnOptions = { stdio: ['ignore', 'pipe', 'pipe'] };

/** What `xtool dev` prints when it names the app it installed. */
const PRINTS_FULL_BUNDLE_ID = { stdout: `bundleIDs = ("${FULL_BUNDLE_ID}")` };

const XTOOL_YML_CASES: Array<{
  name: string;
  write: (project: TestProject) => Promise<void>;
  /** What the run rejects with. */
  error: string;
  /** What the user is told to check. */
  hints: (project: TestProject) => string[];
}> = [
  {
    name: 'no xtool.yml',
    write: (project) => fs.remove(project.ios('xtool.yml')),
    error: 'xtool.yml not found in ios directory',
    hints: () => [],
  },
  {
    name: 'a xtool.yml without bundleID',
    write: (project) => fs.writeFile(project.ios('xtool.yml'), 'name: MyApp\ntarget: app\n'),
    error: 'bundleID not found in xtool.yml',
    hints: (project) => [`Check your xtool.yml file at: ${project.ios('xtool.yml')}`],
  },
  {
    name: 'a xtool.yml whose bundleID is a mapping',
    write: (project) =>
      fs.writeFile(project.ios('xtool.yml'), 'name: MyApp\nbundleID:\n  key: value\n'),
    error: 'Invalid xtool.yml: bundleID should be a string value',
    hints: (project) => [
      'Invalid xtool.yml: bundleID should be a string value, not a mapping',
      'Expected format: bundleID: com.example.app',
      `Check your xtool.yml file at: ${project.ios('xtool.yml')}`,
    ],
  },
  {
    name: 'a xtool.yml whose bundleID is still a template variable',
    write: (project) => fs.writeFile(project.ios('xtool.yml'), 'bundleID: {{appId}}\n'),
    error: 'bundleID contains template variable',
    hints: (project) => [
      'bundleID contains template variable: {{appId}}',
      'Template variables should have been replaced during project creation',
      `Check your xtool.yml file at: ${project.ios('xtool.yml')}`,
    ],
  },
  {
    // A directory where the file should be: reading it fails whoever runs the test.
    name: 'a xtool.yml that cannot be read',
    write: async (project) => {
      await fs.remove(project.ios('xtool.yml'));
      await fs.mkdir(project.ios('xtool.yml'));
    },
    error: 'Failed to read xtool.yml',
    hints: () => ['EISDIR: illegal operation on a directory, read'],
  },
];

/** What `xtool dev` printed when it failed. */
const FAILED_BUILD_OUTPUT: Array<[string, Partial<ExecResult>, string]> = [
  [
    'its stderr',
    { stderr: 'error: no device connected', stdout: 'Installed nothing' },
    'error: no device connected',
  ],
  [
    'its stdout, when stderr is empty',
    { stdout: 'xtool: the build did not finish' },
    'xtool: the build did not finish',
  ],
  ['nothing, reported as Unknown error', {}, 'Unknown error'],
];

/**
 * A log line of the device's syslog that names the app, and the bundle ID the
 * run should take from it. Each line can be read in one way only: the search
 * matches an `XTL-…` ID anywhere, or the value of a `bundleID` field.
 */
const SYSLOG_LINE: Array<[string, string, string]> = [
  ['an XTL-… ID', `some log ${FULL_BUNDLE_ID} more log\n`, FULL_BUNDLE_ID],
  [
    'a bundleID field',
    `Oct 10 10:00:00 iPhone SpringBoard[123] bundleID: A1B2C3D4E5.${BUNDLE_ID} started\n`,
    `A1B2C3D4E5.${BUNDLE_ID}`,
  ],
];

describe('IOSRunCommand', () => {
  let project: TestProject;
  let command: IOSRunCommand;

  /** `process` as the emitter the run adds its signal and exit handlers to. */
  const emitter: EventEmitter = process;
  /** The handlers `process` had before the run, by event: the run adds its own, which are removed after the test. */
  let handlersBefore: Map<string | symbol, unknown[]>;
  /** The timers the run armed. It watches its launcher from an interval that it does not clear by itself. */
  let timeouts: jest.SpyInstance;
  let intervals: jest.SpyInstance;
  /** Every process the run started, in order. */
  const spawned: FakeChildProcess[] = [];
  const spawnWaiters = new Map<number, (proc: FakeChildProcess) => void>();

  /** A fake process where the code under test expects a real one. */
  function processStandIn(): ChildProcess {
    return fakeChildProcess() as unknown as ChildProcess;
  }

  /** The n-th process the run started (counting from 1), once the CLI has asked for it. */
  function spawnedProcess(n: number): Promise<FakeChildProcess> {
    if (spawned.length >= n) {
      return Promise.resolve(spawned[n - 1]);
    }
    return new Promise((resolve) => {
      spawnWaiters.set(n, resolve);
    });
  }

  /** Lets what the run started in the meantime get under way. */
  function flush(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  function xtoolPrints(output: Partial<ExecResult>): void {
    mockedExec.mockResolvedValue({ success: true, stdout: '', stderr: '', code: 0, ...output });
  }

  /**
   * Runs with `idevicesyslog` installed and `xtool dev` naming no bundle ID,
   * so that the run searches the device's syslog first. That search's process
   * is handed over for the test to answer, and so is the log process the run
   * follows once the search is over.
   */
  async function runSearchingSyslog(): Promise<{
    run: Promise<void>;
    search: FakeChildProcess;
    logProcess: () => Promise<FakeChildProcess>;
  }> {
    mockedCheck.mockResolvedValue(true);
    const run = command.runDirectly();
    const search = await spawnedProcess(1);
    return { run, search, logProcess: () => spawnedProcess(2) };
  }

  /**
   * Runs with `idevicesyslog` installed and `xtool dev` naming the app, so
   * that no syslog search comes first: the run follows the log process it
   * starts. That process is handed over for the test to end.
   */
  async function runFollowingLogs(): Promise<{ run: Promise<void>; logProcess: FakeChildProcess }> {
    mockedCheck.mockResolvedValue(true);
    xtoolPrints(PRINTS_FULL_BUNDLE_ID);
    const run = command.runDirectly();
    const logProcess = await spawnedProcess(1);
    return { run, logProcess };
  }

  /** Lets the log process end, which ends the run, and waits for the run. */
  async function endRun(run: Promise<void>, logProcess: FakeChildProcess): Promise<void> {
    logProcess.emit('exit', 0);
    await run;
  }

  /** The one handler the run added to `process` for `event`. */
  function addedHandler(event: string | symbol): () => void {
    const before = handlersBefore.get(event) ?? [];
    const added = emitter.listeners(event).filter((handler) => !before.includes(handler));
    expect(added).toHaveLength(1);
    return added[0] as () => void;
  }

  beforeEach(async () => {
    silenceLogger();
    project = await createTestProject();
    project.setWebApp({ start: 'npm run dev' });

    command = new IOSRunCommand();
    command.setPlatform('ios');
    command.setOptions({ profile: 'development', device: 'abc123' });

    // Not what `gyo create` logged.
    jest.clearAllMocks();
    jest
      .spyOn(WebServerService.prototype, 'start')
      .mockResolvedValue({ process: processStandIn(), url: SERVER_URL });
    // The run watches its launcher with signal 0, which reaches a real process.
    jest.spyOn(process, 'kill').mockImplementation(() => true);
    mockedRequireTool.mockResolvedValue(undefined);
    mockedExec.mockResolvedValue({ success: true, stdout: '', stderr: '', code: 0 });
    // Not installed: no syslog search, no log process, unless a test says otherwise.
    mockedCheck.mockResolvedValue(false);
    spawned.length = 0;
    spawnWaiters.clear();
    mockedSpawn.mockImplementation(() => {
      const proc = fakeChildProcess();
      spawned.push(proc);
      const waiter = spawnWaiters.get(spawned.length);
      spawnWaiters.delete(spawned.length);
      waiter?.(proc);
      return proc as unknown as ChildProcess;
    });
    timeouts = jest.spyOn(globalThis, 'setTimeout');
    intervals = jest.spyOn(globalThis, 'setInterval');
    handlersBefore = new Map(emitter.eventNames().map((name) => [name, emitter.listeners(name)]));
  });

  afterEach(() => {
    // The run leaves its signal and exit handlers on `process`, and its launcher watch armed.
    for (const name of emitter.eventNames()) {
      const before = handlersBefore.get(name) ?? [];
      for (const handler of emitter.listeners(name)) {
        if (!before.includes(handler)) {
          emitter.off(name, handler as (...args: unknown[]) => void);
        }
      }
    }
    for (const { value } of timeouts.mock.results) {
      clearTimeout(value);
    }
    for (const { value } of intervals.mock.results) {
      clearInterval(value);
    }
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    project?.remove();
  });

  describe('what the run needs before it builds', () => {
    it('should stop with PlatformNotFoundError when the project has no ios directory', async () => {
      // Arrange
      await fs.remove(project.ios());

      // Act
      await expect(command.runDirectly()).rejects.toThrow(PlatformNotFoundError);

      // Assert
      expect(mockedRequireTool).not.toHaveBeenCalled();
      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should require xtool, saying where to install it from', async () => {
      // Act
      await command.runDirectly();

      // Assert
      expect(mockedRequireTool).toHaveBeenCalledWith('xtool', XTOOL_HINT);
    });

    it('should change nothing in the project when xtool is not installed', async () => {
      // Arrange
      await fs.outputFile(project.ios('.build', 'stale', 'object.o'), '');
      mockedRequireTool.mockRejectedValue(new ToolRequiredError('xtool', XTOOL_HINT));

      // Act
      await expect(command.runDirectly()).rejects.toThrow(ToolRequiredError);

      // Assert
      expect(mockedExec).not.toHaveBeenCalled();
      await expect(
        fs.pathExists(project.ios('Sources', 'Resources', 'gyo-config.json'))
      ).resolves.toBe(false);
      await expect(fs.pathExists(project.ios('.build', 'stale', 'object.o'))).resolves.toBe(true);
    });
  });

  describe('server URL', () => {
    it('should write the server URL to ios/Sources/Resources/gyo-config.json', async () => {
      // Act
      await command.runDirectly();

      // Assert
      await expect(
        fs.readJson(project.ios('Sources', 'Resources', 'gyo-config.json'))
      ).resolves.toEqual({
        serverUrl: SERVER_URL,
      });
    });

    it('should remove an existing ios/.build before the build', async () => {
      // Arrange
      await fs.outputFile(project.ios('.build', 'stale', 'object.o'), '');
      mockedExec.mockImplementation(async () => {
        expect(await fs.pathExists(project.ios('.build'))).toBe(false);
        return { success: true, stdout: '', stderr: '', code: 0 };
      });

      // Act
      await command.runDirectly();

      // Assert
      expect(mockedExec).toHaveBeenCalledTimes(1);
      await expect(fs.pathExists(project.ios('.build'))).resolves.toBe(false);
    });
  });

  describe('bundle ID', () => {
    // What a developer may write by hand; YAML reads each as the same value.
    it.each([
      ['a quoted bundleID', 'bundleID: "com.example.app"\n', 'com.example.app'],
      [
        'a bundleID with a trailing comment',
        'bundleID: com.example.app # released\n',
        'com.example.app',
      ],
      [
        'a commented-out bundleID above the real one',
        '# bundleID: com.example.old\nbundleID: com.example.new\n',
        'com.example.new',
      ],
    ])('should use the YAML value with $name', async (_name, xtoolYml, expected) => {
      await fs.writeFile(project.ios('xtool.yml'), xtoolYml);
      const { run, search, logProcess } = await runSearchingSyslog();
      search.emit('exit', 0);
      await endRun(run, await logProcess());

      expect(mockedSpawn).toHaveBeenLastCalledWith(
        'idevicesyslog',
        ['-m', expected],
        LOG_PROCESS_OPTIONS
      );
    });

    it('should use the bundle ID of the xtool.yml gyo create wrote', async () => {
      // Arrange: nothing else names the app, so the syslog search is ended empty
      const { run, search, logProcess } = await runSearchingSyslog();
      search.emit('exit', 0);

      // Act
      await endRun(run, await logProcess());

      // Assert
      expect(mockedSpawn).toHaveBeenLastCalledWith(
        'idevicesyslog',
        ['-m', BUNDLE_ID],
        LOG_PROCESS_OPTIONS
      );
    });

    it.each(XTOOL_YML_CASES)(
      'should stop before building with $name',
      async ({ write, error, hints }) => {
        // Arrange
        await write(project);

        // Act
        const run = command.runDirectly();
        await expect(run).rejects.toBeInstanceOf(BuildFailedError);

        // Assert
        await expect(run).rejects.toThrow(error);
        for (const said of [error, ...hints(project)]) {
          expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(said));
        }
        expect(mockedExec).not.toHaveBeenCalled();
      }
    );
  });

  describe('build and install', () => {
    it('should build and install the app with xtool dev in ios/', async () => {
      // Act
      await command.runDirectly();

      // Assert
      expect(mockedExec).toHaveBeenCalledTimes(1);
      expect(mockedExec).toHaveBeenCalledWith('xtool', ['dev'], {
        cwd: project.ios(),
        stdio: 'pipe',
      });
    });

    it.each(FAILED_BUILD_OUTPUT)(
      'should stop with BuildFailedError and show %s when xtool dev fails',
      async (_printed, output, shown) => {
        // Arrange
        mockedExec.mockResolvedValue({
          success: false,
          code: 1,
          stdout: '',
          stderr: '',
          ...output,
        });

        // Act
        const run = command.runDirectly();
        await expect(run).rejects.toBeInstanceOf(BuildFailedError);

        // Assert
        await expect(run).rejects.toThrow('iOS build failed');
        expect(logger.error).toHaveBeenCalledWith(shown);
        expect(mockedSpawn).not.toHaveBeenCalled();
      }
    );

    it.each(['error: typeMismatch in xtool.yml', 'fatal error: Expected to decode Scalar'])(
      'should explain the YAML error xtool dev reported: %p',
      async (xtoolError) => {
        // Arrange
        mockedExec.mockResolvedValue({ success: false, code: 1, stdout: '', stderr: xtoolError });

        // Act
        await expect(command.runDirectly()).rejects.toThrow(BuildFailedError);

        // Assert
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('YAML parsing error in xtool.yml')
        );
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('bundleID should be a simple string value')
        );
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(xtoolError));
      }
    );
  });

  describe('full bundle ID', () => {
    it('should take the bundle ID xtool dev printed as bundleIDs', async () => {
      // Arrange
      const { run, logProcess } = await runFollowingLogs();

      // Act
      await endRun(run, logProcess);

      // Assert
      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenLastCalledWith(
        'idevicesyslog',
        ['-m', FULL_BUNDLE_ID],
        LOG_PROCESS_OPTIONS
      );
    });

    it('should take an XTL-… bundle ID xtool dev printed on stderr', async () => {
      // Arrange: the xtool.yml gyo create wrote, with its underscore; no bundleIDs line, only the
      // line about the installed app
      mockedCheck.mockResolvedValue(true);
      xtoolPrints({ stderr: `Installed XTL-ABC123.${BUNDLE_ID} successfully` });
      const run = command.runDirectly();
      const first = await spawnedProcess(1);
      // Ends a syslog search, should the run have started one instead of the log process.
      first.emit('exit', 0);
      await flush();
      const logProcess = spawned.length > 1 ? await spawnedProcess(2) : first;

      // Act
      await endRun(run, logProcess);

      // Assert
      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenLastCalledWith(
        'idevicesyslog',
        ['-m', `XTL-ABC123.${BUNDLE_ID}`],
        LOG_PROCESS_OPTIONS
      );
    });

    it("should keep the project's bundle ID when xtool dev named another app", async () => {
      // Arrange
      xtoolPrints({ stdout: 'bundleIDs = ("XTL-ABC123.com.example.otherapp")' });
      const { run, search, logProcess } = await runSearchingSyslog();
      search.emit('exit', 0);

      // Act
      await endRun(run, await logProcess());

      // Assert
      expect(mockedSpawn).toHaveBeenLastCalledWith(
        'idevicesyslog',
        ['-m', BUNDLE_ID],
        LOG_PROCESS_OPTIONS
      );
    });

    describe('when only the device syslog can name it', () => {
      beforeEach(() => {
        // The search listens for two seconds; the test must not wait for them.
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      });

      it('should listen to idevicesyslog for up to two seconds, then give up', async () => {
        // Arrange
        const { run, search, logProcess } = await runSearchingSyslog();

        // Act
        await jest.advanceTimersByTimeAsync(1999);
        expect(mockedSpawn).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        await endRun(run, await logProcess());

        // Assert
        expect(mockedSpawn).toHaveBeenNthCalledWith(1, 'idevicesyslog', [], SEARCH_PROCESS_OPTIONS);
        expect(mockedSpawn).toHaveBeenLastCalledWith(
          'idevicesyslog',
          ['-m', BUNDLE_ID],
          LOG_PROCESS_OPTIONS
        );
        expect(search.kill).toHaveBeenCalledWith('SIGTERM');
      });

      it.each(SYSLOG_LINE)(
        'should take the bundle ID the syslog shows as %s',
        async (_shown, line, bundleID) => {
          // Arrange
          const { run, search, logProcess } = await runSearchingSyslog();

          // Act
          search.stdout.emit('data', Buffer.from(line));
          await endRun(run, await logProcess());

          // Assert
          expect(mockedSpawn).toHaveBeenLastCalledWith(
            'idevicesyslog',
            ['-m', bundleID],
            LOG_PROCESS_OPTIONS
          );
          expect(search.kill).toHaveBeenCalledWith('SIGTERM');
        }
      );

      it("should use the project's bundle ID when the search ends before it shows the app", async () => {
        // Arrange
        const { run, search, logProcess } = await runSearchingSyslog();

        // Act
        search.emit('exit', 1);
        await endRun(run, await logProcess());

        // Assert
        expect(mockedSpawn).toHaveBeenLastCalledWith(
          'idevicesyslog',
          ['-m', BUNDLE_ID],
          LOG_PROCESS_OPTIONS
        );
        expect(search.kill).toHaveBeenCalledWith('SIGTERM');
      });

      it("should use the project's bundle ID when the search fails", async () => {
        // Arrange
        const { run, search, logProcess } = await runSearchingSyslog();

        // Act
        search.emit('error', new Error('idevicesyslog: could not connect to the device'));
        await endRun(run, await logProcess());

        // Assert
        expect(mockedSpawn).toHaveBeenLastCalledWith(
          'idevicesyslog',
          ['-m', BUNDLE_ID],
          LOG_PROCESS_OPTIONS
        );
        expect(search.kill).toHaveBeenCalledWith('SIGTERM');
      });
    });
  });

  describe('logs', () => {
    it('should warn and end the run when idevicesyslog is not installed', async () => {
      // Act
      await expect(command.runDirectly()).resolves.toBeUndefined();

      // Assert
      expect(mockedSpawn).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'idevicesyslog not found. Install libimobiledevice for log monitoring.'
      );
    });

    it('should follow idevicesyslog -m <bundle id> until the process exits', async () => {
      // Arrange
      const { run, logProcess } = await runFollowingLogs();
      let outcome = 'still running';
      run.then(
        () => (outcome = 'ended'),
        () => (outcome = 'failed')
      );

      // Assert: the process is followed, and the run waits for it
      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith(
        'idevicesyslog',
        ['-m', FULL_BUNDLE_ID],
        LOG_PROCESS_OPTIONS
      );
      await flush();
      expect(outcome).toBe('still running');

      // Act
      await endRun(run, logProcess);

      // Assert
      expect(outcome).toBe('ended');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should report stdout lines and pass stderr lines on as warnings', async () => {
      // Arrange
      const { run, logProcess } = await runFollowingLogs();

      // Act
      logProcess.stdout.emit('data', Buffer.from('log line 1\nlog line 2\n'));
      logProcess.stderr.emit('data', Buffer.from('a device warning\n'));
      await endRun(run, logProcess);

      // Assert
      expect(logger.info).toHaveBeenCalledWith(`${EMOJI.PHONE} log line 1`);
      expect(logger.info).toHaveBeenCalledWith(`${EMOJI.PHONE} log line 2`);
      expect(logger.warn).toHaveBeenCalledWith('a device warning');
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('log line'));
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('a device warning'));
    });

    it('should warn when the log process exits with a non-zero code', async () => {
      // Arrange
      const { run, logProcess } = await runFollowingLogs();

      // Act
      logProcess.emit('exit', 1);

      // Assert
      await expect(run).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('Log monitoring stopped');
    });

    it('should fail the run when the log process cannot be started', async () => {
      // Arrange
      const { run, logProcess } = await runFollowingLogs();

      // Act
      logProcess.emit('error', new Error('spawn idevicesyslog ENOENT'));

      // Assert
      await expect(run).rejects.toThrow('spawn idevicesyslog ENOENT');
    });

    it('should end quietly when the log process fails while the CLI is stopping', async () => {
      // Arrange
      const { run, logProcess } = await runFollowingLogs();
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      // Act: Ctrl+C
      addedHandler('SIGINT')();
      logProcess.emit('error', new Error('spawn idevicesyslog ENOENT'));

      // Assert
      await expect(run).resolves.toBeUndefined();
      expect(exit).toHaveBeenCalledWith(0);
      expect(logger.warn).not.toHaveBeenCalledWith('Log monitoring stopped');
    });
  });

  describe('success message', () => {
    it('should ask for the app to be opened and name the server it connects to', async () => {
      // Act
      await command.runDirectly();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('tap the app icon on your device')
      );
      expect(logger.success).toHaveBeenCalledWith(`App is connected to: ${SERVER_URL}`);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Ctrl+C'));
    });
  });
});
