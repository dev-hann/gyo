#!/usr/bin/env node

import { Command } from "commander";
import { registerCreateCommand } from "./commands/create.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerRunCommand } from "./commands/run.js";
import { registerCleanCommand } from "./commands/clean.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerDevicesCommand } from "./commands/devices.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerPluginCommand } from "./commands/plugin.js";
import { registerAddCommand } from "./commands/add.js";
import { registerUpgradeCommand } from "./commands/upgrade.js";
import { registerDebugCommand } from "./commands/debug.js";

const program = new Command();

program
  .name("gyo")
  .description("CLI tool for gyo framework - Bridge between web and native")
  .version("0.1.0");

registerCreateCommand(program);
registerInstallCommand(program);
registerAddCommand(program);
registerPluginCommand(program);
registerBuildCommand(program);
registerRunCommand(program);
registerCleanCommand(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerDevicesCommand(program);
registerUpgradeCommand(program);
registerDebugCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
