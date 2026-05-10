import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import type { BaseCommand, Platform, BaseCommandOptions } from './commands/base/index';
import { BuildCommand } from './commands/build';
import { RunCommand } from './commands/run';
import { CleanCommand } from './commands/clean';
import { ConfigCommand } from './commands/config';
import { CreateCommand } from './commands/create';
import { DoctorCommand } from './commands/doctor';
import { DevicesCommand } from './commands/devices';
import { UpgradeCommand } from './commands/upgrade';
import { DebugCommand } from './commands/debug';
import { GyoError, getErrorMessage } from './core/index';
import { logger } from './utils/logger';

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`Failed to read package.json for version: ${message}`);
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
    const options = args.length >= 2 ? args[args.length - 2] : {};
    const positionalArgs = args.length >= 2 ? args.slice(0, -2) : args;

    cmd.setOptions(options);

    const arg0 = positionalArgs[0];
    if (meta.positionalHandler === 'platform' && arg0) {
      (cmd as unknown as { setPlatform(p: Platform): void }).setPlatform(arg0 as Platform);
    } else if (meta.positionalHandler === 'platformWithAll') {
      (cmd as unknown as { setPlatform(p: string): void }).setPlatform(arg0 || 'all');
    } else if (meta.positionalHandler === 'projectName' && arg0) {
      (cmd as unknown as { setProjectName(n: string): void }).setProjectName(arg0);
    }

    await cmd.execute();
  });
}

function registerConfigCommand(): void {
  const meta = new ConfigCommand().getMeta();
  const config = program.command(meta.name).description(meta.description);

  const subcommands = ConfigCommand.getSubcommands();
  subcommands.forEach((sub) => {
    let sc = config.command(sub.name).description(sub.description);
    if (sub.arguments) sc = sc.arguments(sub.arguments);

    sc.action(async (...args) => {
      const options = args.length >= 2 ? args[args.length - 2] : {};
      const positionalArgs = args.length >= 2 ? args.slice(0, -2) : args;

      const cmd = new ConfigCommand();
      cmd.setOptions(options);
      cmd.setAction(sub.name as 'show' | 'set' | 'get');

      if (sub.name === 'set') {
        cmd.setKeyValue(positionalArgs[0], positionalArgs[1]);
      } else if (sub.name === 'get') {
        cmd.setKeyValue(positionalArgs[0]);
      }

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

function handleUnhandledRejection(error: unknown): void {
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
  const errorMessage = getErrorMessage(error);
  logger.error(`Unexpected error: ${errorMessage}`);
  if (error instanceof Error && error.stack && process.env.DEBUG) {
    logger.debug(error.stack);
  }
  process.exit(1);
}

process.on('unhandledRejection', handleUnhandledRejection);

void program.parseAsync(process.argv).then(() => {
  if (!process.argv.slice(2).length) {
    logger.log('');
    logger.info('Welcome to gyo! Get started: gyo create my-app');
    logger.log('');
    program.outputHelp();
  }
});
