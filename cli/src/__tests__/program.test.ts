import type { Command } from 'commander';
import { CommanderError } from 'commander';
import { createProgram } from '../program';
import { BaseCommand } from '../commands/base';
import type { CommandMeta } from '../commands/base';

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
interface Routed {
  meta: CommandMeta;
  options: Record<string, unknown>;
  platform: unknown;
}

/** Throws Commander's errors instead of exiting the process, on every command. */
function throwing(program: Command): Command {
  program.exitOverride();
  program.commands.forEach(throwing);
  return program;
}

async function route(argv: string[]): Promise<{ routed: Routed[]; help: string }> {
  const executed = jest.spyOn(BaseCommand.prototype, 'execute').mockResolvedValue(undefined);
  let help = '';
  try {
    await throwing(createProgram())
      .configureOutput({ writeOut: (text) => (help += text) })
      .parseAsync(['node', 'gyo', ...argv]);
  } catch (error) {
    // The code of a help request differs between Commander versions.
    if (!(error instanceof CommanderError) || !/^commander\.(help|outputhelp)/i.test(error.code)) {
      throw error;
    }
  }

  const routed = executed.mock.contexts.map(
    (command) =>
      ({
        meta: (command as BaseCommand).getMeta(),
        options: (command as unknown as { options: Record<string, unknown> }).options,
        platform: (command as unknown as { platform?: unknown }).platform,
      }) as Routed
  );
  executed.mockRestore();

  return { routed, help };
}

describe('program', () => {
  it.each([
    {
      argv: ['create', 'my-app', '--force'],
      name: 'create',
      options: { projectName: 'my-app', force: true },
    },
    {
      argv: ['build', 'android'],
      name: 'build',
      options: { profile: 'development', release: false },
      platform: 'android',
    },
    {
      argv: ['build', 'ios', '-p', 'staging', '--release'],
      name: 'build',
      options: { profile: 'staging', release: true },
      platform: 'ios',
    },
    {
      argv: ['run', '--port', '5173', '-d', 'abc', '-v'],
      name: 'run',
      options: { profile: 'development', port: 5173, device: 'abc', verbose: true },
    },
    { argv: ['clean'], name: 'clean', platform: 'all' },
    { argv: ['clean', 'lib'], name: 'clean', platform: 'lib' },
    { argv: ['install', '-p', 'android'], name: 'install', options: { platform: 'android' } },
    { argv: ['config', 'get', 'name'], name: 'config', options: { action: 'get', key: 'name' } },
    {
      argv: ['config', 'set', 'version', '2'],
      name: 'config',
      options: { action: 'set', key: 'version', value: '2' },
    },
  ])('should route `gyo $argv` to its command', async ({ argv, name, options, platform }) => {
    const { routed } = await route(argv);

    expect(routed).toHaveLength(1);
    expect(routed[0].meta.name).toBe(name);
    if (options) {
      expect(routed[0].options).toMatchObject(options);
    }
    if (platform) {
      expect(routed[0].platform).toBe(platform);
    }
  });

  it('should run exactly one command', async () => {
    const { routed } = await route(['devices', '--json']);

    expect(routed.map(({ meta }) => meta.name)).toEqual(['devices']);
    expect(routed[0].options).toMatchObject({ json: true });
  });

  it('should refuse a port that is not one, before the command runs', async () => {
    await expect(route(['run', '--port', 'abc'])).rejects.toThrow(
      'The port must be an integer from 1 to 65535'
    );
  });

  it('should name the argument a command is missing', async () => {
    await expect(route(['build'])).rejects.toThrow("missing required argument 'platform'");
    await expect(route(['create'])).rejects.toThrow("missing required argument 'project-name'");
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
