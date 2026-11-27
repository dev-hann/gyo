import { Command } from 'commander';
import type { BaseCommand, BaseCommandOptions } from './commands/base/index';
import { BuildCommand } from './commands/build';
import { RunCommand } from './commands/run';
import { CleanCommand } from './commands/clean';
import { ConfigCommand } from './commands/config';
import type { ConfigAction } from './commands/config';
import { CreateCommand } from './commands/create';
import { DoctorCommand } from './commands/doctor';
import { DevicesCommand } from './commands/devices';
import { UpgradeCommand } from './commands/upgrade';
import { DebugCommand } from './commands/debug';
import { InstallCommand } from './commands/install';
import { getErrorMessage } from './core/index';
import { logger } from './utils/logger';
import { getCliVersion } from './utils/paths';

function getVersion(): string {
  try {
    return getCliVersion();
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`Failed to read package.json for version: ${message}`);
    return '0.0.0';
  }
}

/** Commander hands an action its positional arguments, then the options, then the command. */
function run(cmd: BaseCommand<BaseCommandOptions>, args: unknown[]): Promise<void> {
  // An optional argument that was left out arrives as undefined.
  const positional = (args.slice(0, -2) as unknown[]).filter(
    (arg): arg is string => typeof arg === 'string'
  );
  const options = (args[args.length - 2] ?? {}) as BaseCommandOptions;

  cmd.setPositionalArgs(positional);
  cmd.setOptions(options);
  return cmd.execute();
}

function registerCommand(program: Command, cmd: BaseCommand<BaseCommandOptions>): void {
  const meta = cmd.getMeta();
  let command = program.command(meta.name).description(meta.description);

  if (meta.arguments) {
    command = command.arguments(meta.arguments);
  }
  for (const option of meta.options ?? []) {
    command = option.parse
      ? command.option(option.flags, option.description, option.parse, option.default)
      : command.option(option.flags, option.description, option.default);
  }

  command.action(async (...args: unknown[]) => run(cmd, args));
}

function registerConfigCommand(program: Command): void {
  const meta = new ConfigCommand().getMeta();
  const config = program.command(meta.name).description(meta.description);

  for (const sub of ConfigCommand.getSubcommands()) {
    let command = config.command(sub.name).description(sub.description);
    if (sub.arguments) {
      command = command.arguments(sub.arguments);
    }

    command.action(async (...args: unknown[]) => {
      const [key, value] = args
        .slice(0, -2)
        .filter((arg): arg is string => typeof arg === 'string');
      const cmd = new ConfigCommand();
      cmd.setAction(sub.name as ConfigAction);
      if (sub.name === 'get') cmd.setKeyValue(key);
      if (sub.name === 'set') cmd.setKeyValue(key, value);

      await run(cmd, args);
    });
  }
}

/** The CLI as Commander defines it: every command, its arguments and options. */
export function createProgram(): Command {
  const program = new Command()
    .name('gyo')
    .description('CLI tool for gyo framework - Bridge between web and native')
    .version(getVersion());

  registerCommand(program, new BuildCommand());
  registerCommand(program, new RunCommand());
  registerCommand(program, new CleanCommand());
  registerCommand(program, new CreateCommand());
  registerCommand(program, new DoctorCommand());
  registerCommand(program, new DevicesCommand());
  registerCommand(program, new UpgradeCommand());
  registerCommand(program, new DebugCommand());
  registerCommand(program, new InstallCommand());
  registerConfigCommand(program);

  return program;
}
