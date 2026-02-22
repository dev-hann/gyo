#!/usr/bin/env node

import { Command } from "commander";
import { BaseCommand, Platform } from "./commands/base/index.js";
import { BuildCommand } from "./commands/build.js";
import { RunCommand } from "./commands/run.js";
import { CleanCommand } from "./commands/clean.js";
import { ConfigCommand } from "./commands/config.js";
import { CreateCommand } from "./commands/create.js";
import { DoctorCommand } from "./commands/doctor.js";
import { DevicesCommand } from "./commands/devices.js";
import { UpgradeCommand } from "./commands/upgrade.js";
import { DebugCommand } from "./commands/debug.js";

const program = new Command();

program
  .name("gyo")
  .description("CLI tool for gyo framework - Bridge between web and native")
  .version("0.1.0");

function registerCommand(cmd: BaseCommand<any>): void {
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
    const options = args.pop();
    const positionalArgs = args;

    if (cmd instanceof BuildCommand) {
      cmd.setPlatform(positionalArgs[0] as Platform);
    } else if (cmd instanceof CleanCommand) {
      cmd.setPlatform(positionalArgs[0] || "all");
    } else if (cmd instanceof CreateCommand) {
      cmd.setProjectName(positionalArgs[0]);
    } else if (cmd instanceof DebugCommand) {
      cmd.setPlatform(positionalArgs[0] as Platform);
    }

    cmd.setOptions(options);
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
      cmd.setAction(sub.name as "show" | "set" | "get");

      if (sub.name === "set") {
        cmd.setKeyValue(positionalArgs[0], positionalArgs[1]);
      } else if (sub.name === "get") {
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

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
