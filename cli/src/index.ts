import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { BaseCommand, Platform, BaseCommandOptions } from './commands/base/index';
import { BuildCommand } from './commands/build';
import { RunCommand } from './commands/run';
import { CleanCommand } from './commands/clean';
import { ConfigCommand } from './commands/config';
import { CreateCommand } from './commands/create';
import { DoctorCommand } from './commands/doctor';
import { DevicesCommand } from './commands/devices';
import { UpgradeCommand } from './commands/upgrade';
import { DebugCommand } from './commands/debug';
import { GyoError } from './core/index';
import { logger } from './utils/logger';

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`Failed to read package.json for version: ${message}`);
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('gyo')
  .description('CLI tool for gyo framework - Bridge between web and native')
  .version(getVersion());

function registerCommand(cmd: BaseCommand<BaseCommandOptions>): void {
  const meta = cmd.getMeta();
  let c = program.command(meta.name).description(meta.description);

  if (meta.arguments) c = c.arguments(meta.arguments);
  meta.options?.forEach((opt) => {
    if (opt.default !== undefined) {
      c = c.option(opt.flags, opt.description, opt.default);
    } else {
      c = c.option(opt.flags, opt.description);
    }
  });

  c.action(async (...args) => {
    const options = args.length >= 2 ? args[args.length - 2] : args.pop();
    const positionalArgs = args.slice(0, -2);

    cmd.setOptions(options);

    if (cmd instanceof BuildCommand) {
      cmd.setPlatform(positionalArgs[0] as Platform);
    } else if (cmd instanceof CleanCommand) {
      cmd.setPlatform(positionalArgs[0] || 'all');
    } else if (cmd instanceof CreateCommand) {
      cmd.setProjectName(positionalArgs[0]);
    } else if (cmd instanceof DebugCommand) {
      cmd.setPlatform(positionalArgs[0] as Platform);
    }

    await cmd.execute();
  });
}

function registerConfigCommand(): void {
  const meta = ConfigCommand.prototype.getMeta.call({});
  const config = program.command(meta.name).description(meta.description);

  const subcommands = ConfigCommand.getSubcommands();
  subcommands.forEach((sub) => {
    let sc = config.command(sub.name).description(sub.description);
    if (sub.arguments) sc = sc.arguments(sub.arguments);

    sc.action(async (...args) => {
      const options = args.pop();
      const positionalArgs = args;

      const cmd = new ConfigCommand();
      cmd.setAction(sub.name as 'show' | 'set' | 'get');

      if (sub.name === 'set') {
        cmd.setKeyValue(positionalArgs[0], positionalArgs[1]);
      } else if (sub.name === 'get') {
        cmd.setKeyValue(positionalArgs[0]);
      }

      cmd.setOptions(options);
      await cmd.execute();
    });
  });
}

registerCommand(new BuildCommand());
registerCommand(new RunCommand());
registerCommand(new CleanCommand());
registerCommand(new CreateCommand());
registerCommand(new DoctorCommand());
registerCommand(new DevicesCommand());
registerCommand(new UpgradeCommand());
registerCommand(new DebugCommand());
registerConfigCommand();

process.on('unhandledRejection', (error: unknown) => {
  if (error instanceof GyoError) {
    logger.error(error.message);
    process.exit(error.exitCode);
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'commander.help'
  ) {
    process.exit(0);
  }
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Unexpected error: ${errorMessage}`);
  if (error instanceof Error && error.stack && process.env.DEBUG) {
    logger.debug(error.stack);
  }
  process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  logger.log('');
  logger.info('Welcome to gyo! Get started: gyo create my-app');
  logger.log('');
  program.outputHelp();
}
