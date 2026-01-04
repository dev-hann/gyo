#!/usr/bin/env node

import { Command } from "commander";
import { registerCreateCommand } from "./commands/create.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerRunCommand } from "./commands/run.js";
import { registerCleanCommand } from "./commands/clean.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerDevicesCommand } from "./commands/devices.js";

const program = new Command();

program
  .name("gyo")
  .description("CLI tool for the gyo framework - Bridge between web and native")
  .version("0.1.0");

registerCreateCommand(program);
registerBuildCommand(program);
registerRunCommand(program);
registerCleanCommand(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerDevicesCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
