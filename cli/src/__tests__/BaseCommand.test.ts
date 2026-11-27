import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import type { BaseCommandOptions, CommandMeta } from '../commands/base/BaseCommand';
import { BaseCommand } from '../commands/base/BaseCommand';
import { PlatformCommand } from '../commands/base/PlatformCommand';
import type { GyoConfig } from '../core/index';
import { GyoError } from '../core/index';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot
// run. `createTestProject()` makes its project from the real templates.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

/** The spinner as `ora` gives a command: running from `start()` until something ends it. */
interface Spinner {
  isSpinning: boolean;
  start: jest.Mock;
  stop: jest.Mock;
  succeed: jest.Mock;
  fail: jest.Mock;
  warn: jest.Mock;
}

/** Every spinner made; the last one belongs to the command a test just made. */
const mockSpinners: Spinner[] = [];

jest.mock('ora', () => {
  const ora = (): Spinner => {
    const end = (): void => {
      spinner.isSpinning = false;
    };
    const spinner: Spinner = {
      isSpinning: false,
      start: jest.fn(() => {
        spinner.isSpinning = true;
      }),
      stop: jest.fn(end),
      succeed: jest.fn(end),
      fail: jest.fn(end),
      warn: jest.fn(end),
    };
    mockSpinners.push(spinner);
    return spinner;
  };
  return ora;
});

interface RecordingOptions extends BaseCommandOptions {
  name?: string;
}

/** How a recording command ends its `run()`. */
interface Ending {
  /** What it throws. */
  throws?: unknown;
  /** Whether it starts its spinner first, as a command with work to do does. */
  spinner?: boolean;
}

/** A command that records what it was given and how it was run. */
class RecordingCommand extends BaseCommand<RecordingOptions> {
  /** Whether `run()` ran, and whether `beforeRun()` had finished when it began. */
  ran = false;
  ranAfterChecks = false;
  /** `this.options` and `this.config` as `run()` saw them. */
  optionsAtRun: RecordingOptions | undefined;
  configAtRun: GyoConfig | null | undefined;
  /** Set by `beforeRun()` once its check is over. */
  private checked = false;

  constructor(private readonly ending: Ending = {}) {
    super();
  }

  getMeta(): CommandMeta {
    return { name: 'record', description: 'Records what it is given', arguments: '[name]' };
  }

  // As CreateCommand does: an argument goes into the options.
  setPositionalArgs([name]: string[]): void {
    this.options = { ...this.options, name };
  }

  protected async beforeRun(): Promise<void> {
    await Promise.resolve();
    this.checked = true;
  }

  protected async run(): Promise<void> {
    this.ran = true;
    this.ranAfterChecks = this.checked;
    this.optionsAtRun = this.options;
    this.configAtRun = this.config;
    if (this.ending.spinner) {
      this.startSpinner('Working...');
    }
    if (this.ending.throws !== undefined) {
      throw this.ending.throws;
    }
  }
}

/** A command bound to a platform of a project, as `gyo build` and `gyo run` run one. */
class ProjectCommand extends PlatformCommand {
  ran = false;
  /** `this.config` as `run()` saw it. */
  configAtRun: GyoConfig | null | undefined;

  protected async run(): Promise<void> {
    this.ran = true;
    this.configAtRun = this.config;
  }
}

describe('BaseCommand', () => {
  let workDir: string;
  let previousCwd: string;
  let project: TestProject | undefined;

  /** Runs a command as the entry point does once it handed it its options. */
  async function execute(command: BaseCommand, options: BaseCommandOptions = {}): Promise<void> {
    command.setOptions(options);
    return command.execute();
  }

  /** What `execute()` rejects with, for a command that ends as `ending` says. */
  function failureOf(ending: Ending): Promise<unknown> {
    return execute(new RecordingCommand(ending)).catch((error: unknown) => error);
  }

  /** Runs a platform command as `gyo build` and `gyo run` do: its checks, then `run()`. */
  function runDirectly(command: PlatformCommand): Promise<void> {
    command.setOptions({});
    return command.runDirectly();
  }

  /** The spinner of the command a test just made. */
  function lastSpinner(): Spinner {
    return mockSpinners[mockSpinners.length - 1];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
    mockSpinners.length = 0;
    previousCwd = process.cwd();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-base-command-'));
    process.chdir(workDir);
  });

  afterEach(() => {
    if (project) {
      project.remove();
      project = undefined;
    }
    process.chdir(previousCwd);
    fs.removeSync(workDir);
    logger.resetVerbose();
  });

  describe('setOptions', () => {
    it.each([
      ['after the arguments, as the entry point gives them', false],
      ['before the arguments, as a command that runs another command gives them', true],
    ])(
      'should merge the options into what the command has when they come %s',
      async (_, optionsFirst) => {
        const command = new RecordingCommand();
        if (optionsFirst) {
          command.setOptions({ verbose: true });
          command.setPositionalArgs(['demo-app']);
        } else {
          command.setPositionalArgs(['demo-app']);
          command.setOptions({ verbose: true });
        }
        await command.execute();

        expect(command.optionsAtRun).toEqual({ verbose: true, name: 'demo-app' });
      }
    );

    it.each([
      ['true', { verbose: true }, true],
      ['false', { verbose: false }, false],
    ])('should tell the logger the verbose mode it was given: %s', async (_, options, verbose) => {
      await execute(new RecordingCommand(), options);

      expect(logger.setVerbose).toHaveBeenCalledTimes(1);
      expect(logger.setVerbose).toHaveBeenCalledWith(verbose);
    });

    it.each([
      ['no options', {}],
      ['verbose left out', { verbose: undefined }],
    ])('should leave the verbose mode of the logger alone when given %s', async (_, options) => {
      await execute(new RecordingCommand(), options);

      expect(logger.setVerbose).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should call run and succeed', async () => {
      const command = new RecordingCommand();

      await expect(execute(command)).resolves.toBeUndefined();

      expect(command.ran).toBe(true);
    });

    it('should let beforeRun finish before run begins', async () => {
      const command = new RecordingCommand();

      await execute(command);

      expect(command.ranAfterChecks).toBe(true);
    });
  });

  describe('requireGyoProject', () => {
    it('should throw GyoError when config file does not exist', async () => {
      const command = new ProjectCommand();

      const run = runDirectly(command);
      await expect(run).rejects.toThrow(GyoError);
      await expect(run).rejects.toThrow(
        `Not a gyo project (gyo.config.json not found in ${workDir}).\n` +
          "  Run 'gyo create <project-name>' to create a new project."
      );
      expect(command.ran).toBe(false);
    });

    it('should not throw when config file exists', async () => {
      project = await createTestProject();
      const command = new ProjectCommand();

      await expect(runDirectly(command)).resolves.toBeUndefined();

      expect(command.ran).toBe(true);
    });
  });

  describe('loadConfiguration', () => {
    it('should give the command the gyo.config.json of its project', async () => {
      project = await createTestProject();
      await project.setConfig({ version: '2.0.0' });
      const command = new ProjectCommand();

      await runDirectly(command);

      expect(command.configAtRun).toEqual(await fs.readJson(project.file('gyo.config.json')));
      expect(command.configAtRun).toMatchObject({ name: 'demo-app', version: '2.0.0' });
    });

    it('should give a command no config until it loads one', async () => {
      const command = new RecordingCommand();

      await execute(command);

      expect(command.configAtRun).toBeNull();
    });

    // Reported once: by handleError. A failed load adds no report of its own.
    it.each<[string, (project: TestProject) => Promise<void>, string | RegExp]>([
      [
        'invalid',
        (project) => project.setConfig({ name: 17 }),
        "Invalid gyo.config.json:\n  - 'name' must be a non-empty string",
      ],
      [
        'unreadable',
        (project) => fs.writeFile(project.file('gyo.config.json'), '{ not json'),
        /^Failed to load config:/,
      ],
    ])('should fail on an %s config before run, reported once', async (_, breakConfig, message) => {
      project = await createTestProject();
      await breakConfig(project);
      const command = new ProjectCommand();
      command.setOptions({});

      await expect(command.execute()).rejects.toThrow(message);

      expect(command.ran).toBe(false);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(message));
    });
  });

  describe('handleError', () => {
    it('should re-throw GyoError as-is', async () => {
      const gyoError = new GyoError('custom error', 3);

      const caught = await failureOf({ throws: gyoError });

      expect(caught).toBe(gyoError);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('custom error');
    });

    it('should wrap generic Error in GyoError', async () => {
      const original = new Error('generic');

      const caught = await failureOf({ throws: original });

      expect(caught).toBeInstanceOf(GyoError);
      expect(caught).toMatchObject({ message: 'generic', cause: original });
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('generic');
    });

    it('should wrap non-Error in GyoError', async () => {
      const caught = await failureOf({ throws: 'string error' });

      expect(caught).toBeInstanceOf(GyoError);
      expect(caught).toMatchObject({ message: 'string error', cause: 'string error' });
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('string error');
      // There is no stack to give.
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should log the stack at debug level', async () => {
      await failureOf({ throws: new Error('test msg') });

      expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/^Error: test msg\n\s+at /));
    });

    it('should fail a spinner that is running', async () => {
      const command = new RecordingCommand({ throws: new Error('test msg'), spinner: true });
      const spinner = lastSpinner();
      command.setOptions({});

      await command.execute().catch(() => undefined);

      expect(spinner.fail).toHaveBeenCalledTimes(1);
      expect(spinner.fail).toHaveBeenCalledWith('Command failed');
    });

    it('should not fail a spinner that never started', async () => {
      const command = new RecordingCommand({ throws: new Error('test msg') });
      const spinner = lastSpinner();
      command.setOptions({});

      await command.execute().catch(() => undefined);

      expect(spinner.fail).not.toHaveBeenCalled();
    });
  });
});
