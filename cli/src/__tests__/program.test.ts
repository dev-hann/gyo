import type { Command } from 'commander';
import { CommanderError } from 'commander';
import { createProgram } from '../program';
import { BaseCommand } from '../commands/base';
import type { CommandMeta, RegisteredCommand } from '../commands/base';
import { BuildCommand } from '../commands/build';
import { CleanCommand } from '../commands/clean';
import { ConfigCommand } from '../commands/config';
import { CreateCommand } from '../commands/create';

jest.mock('../utils/paths', () => ({ getCliVersion: () => '0.0.0-test' }));
// ESM-only, and no command runs here.
jest.mock('inquirer', () => ({ prompt: jest.fn(), default: { prompt: jest.fn() } }));
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    log: jest.fn(),
    setVerbose: jest.fn(),
    isVerbose: jest.fn().mockReturnValue(false),
    suggestNextSteps: jest.fn(),
  },
}));

// Commander is what turns a command line into a command, its arguments and
// its options. These tests go through it: calling a command's methods
// directly never showed that an argument was declared twice, which broke
// `gyo create` and `gyo build` in the bundle while every unit test passed.

/** A command Commander ran, and what it was handed through its public setters. */
interface Routed {
  meta: CommandMeta;
  /** The positional arguments it was handed. */
  args: string[];
  /** The options it was handed, as Commander parsed them. */
  options: Record<string, unknown>;
  /** A `config` subcommand: what it was asked to do. */
  config?: { action: string; key: string; value?: string };
}

/** What Commander made of a command line. */
interface Parsed {
  /** Each command that ran, in order. */
  routed: Routed[];
  /** What went to stdout: the help. */
  help: string;
  /** What went to stderr: why Commander refused the command line, when it did. */
  error: string;
}

/**
 * Throws Commander's errors instead of exiting the process and keeps what it
 * writes, on every command. Commander copies the output to a command when the
 * command is made, so setting it on the program afterwards would leave every
 * subcommand writing to the real streams.
 */
function capture(program: Command, parsed: Parsed): void {
  program.exitOverride().configureOutput({
    writeOut: (text) => (parsed.help += text),
    writeErr: (text) => (parsed.error += text),
  });
  program.commands.forEach((command) => capture(command, parsed));
}

/**
 * Where the positional arguments arrive. `CreateCommand`, `BuildCommand` and
 * `CleanCommand` take them their own way; every other command takes the base's.
 */
const TAKES_POSITIONAL_ARGS = [BaseCommand, CreateCommand, BuildCommand, CleanCommand];

/** What `spy` was called with on `receiver`, each time it was. */
function callsOn<A extends unknown[]>(
  spy: { mock: { calls: A[]; contexts: unknown[] } },
  receiver: unknown
): A[] {
  return spy.mock.calls.filter((_, call) => spy.mock.contexts[call] === receiver);
}

/** Parses `argv` as the entry point does, with what each command was handed. No command runs. */
async function route(argv: string[]): Promise<Parsed> {
  const setPositionalArgs = TAKES_POSITIONAL_ARGS.map((Owner) =>
    jest.spyOn(Owner.prototype, 'setPositionalArgs')
  );
  const setOptions = jest.spyOn(BaseCommand.prototype, 'setOptions');
  const setAction = jest.spyOn(ConfigCommand.prototype, 'setAction');
  const setKeyValue = jest.spyOn(ConfigCommand.prototype, 'setKeyValue');
  const executed = jest.spyOn(BaseCommand.prototype, 'execute').mockResolvedValue(undefined);

  const parsed: Parsed = { routed: [], help: '', error: '' };
  const program = createProgram();
  capture(program, parsed);
  try {
    await program.parseAsync(['node', 'gyo', ...argv]);
  } catch (error) {
    // Help ends the parse the same way a refusal does.
    if (!(error instanceof CommanderError)) {
      throw error;
    }
  }

  parsed.routed = executed.mock.contexts.map((command: BaseCommand & RegisteredCommand) => {
    const [options] = callsOn(setOptions, command)[0] ?? [];
    const [action] = callsOn(setAction, command)[0] ?? [];
    const [key, value] = callsOn(setKeyValue, command)[0] ?? [];
    return {
      meta: command.getMeta(),
      args: setPositionalArgs.flatMap((spy) => callsOn(spy, command))[0]?.[0] ?? [],
      options: { ...options },
      config: action === undefined ? undefined : { action, key, value },
    };
  });
  return parsed;
}

describe('program', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    {
      argv: ['create', 'my-app', '--force'],
      name: 'create',
      args: ['my-app'],
      options: { force: true },
    },
    {
      argv: ['build', 'android'],
      name: 'build',
      args: ['android'],
      options: { profile: 'development', release: false },
    },
    {
      argv: ['build', 'ios', '-p', 'staging', '--release'],
      name: 'build',
      args: ['ios'],
      options: { profile: 'staging', release: true },
    },
    {
      argv: ['run', '--port', '5173', '-d', 'abc', '-v'],
      name: 'run',
      args: [],
      options: { profile: 'development', port: 5173, device: 'abc', verbose: true },
    },
    { argv: ['clean'], name: 'clean', args: [] },
    { argv: ['clean', 'lib'], name: 'clean', args: ['lib'] },
    {
      argv: ['install', '-p', 'android'],
      name: 'install',
      args: [],
      options: { platform: 'android' },
    },
    {
      argv: ['config', 'get', 'name'],
      name: 'config',
      args: ['name'],
      config: { action: 'get', key: 'name' },
    },
    {
      argv: ['config', 'set', 'version', '2'],
      name: 'config',
      args: ['version', '2'],
      config: { action: 'set', key: 'version', value: '2' },
    },
  ])('should route `gyo $argv` to its command', async ({ argv, name, args, options, config }) => {
    const { routed, error } = await route(argv);

    expect(error).toBe('');
    expect(routed).toHaveLength(1);
    expect(routed[0].meta.name).toBe(name);
    // Strict: an operand left out must not arrive as undefined.
    expect(routed[0].args).toStrictEqual(args);
    if (options) {
      expect(routed[0].options).toMatchObject(options);
    }
    if (config) {
      expect(routed[0].config).toEqual(config);
    }
  });

  it('should run exactly one command', async () => {
    const { routed } = await route(['devices', '--json']);

    expect(routed.map(({ meta }) => meta.name)).toEqual(['devices']);
    expect(routed[0].options).toMatchObject({ json: true });
  });

  it('should refuse a port that is not one, before the command runs', async () => {
    const { routed, error } = await route(['run', '--port', 'abc']);

    expect(error).toContain('The port must be an integer from 1 to 65535');
    expect(routed).toEqual([]);
  });

  it('should name the argument a command is missing', async () => {
    expect((await route(['build'])).error).toContain("missing required argument 'platform'");
    expect((await route(['create'])).error).toContain("missing required argument 'project-name'");
  });

  it('should list every command with its arguments in the help', async () => {
    const { routed, help } = await route(['--help']);

    expect(routed).toEqual([]);
    for (const line of [
      'create [options] <project-name>',
      'build [options] <platform>',
      'debug <platform>',
      'run [options]',
      'clean [platform]',
      'install [options]',
      'config',
    ]) {
      expect(help).toContain(line);
    }
  });
});
