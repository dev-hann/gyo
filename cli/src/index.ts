#!/usr/bin/env node

import { Command } from 'commander';
import { registerCreateCommand } from './commands/create.ts';
import { registerBuildCommand } from './commands/build.ts';
import { registerRunCommand } from './commands/run.ts';
import { registerCleanCommand } from './commands/clean.ts';
import { registerConfigCommand } from './commands/config.ts';
import { registerDoctorCommand } from './commands/doctor.ts';
import { registerDevicesCommand } from './commands/devices.ts';

const program = new Command();

program
  .name('gyo')
  .description('CLI tool for the gyo framework - Bridge between web and native')
  .version('0.1.0');

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
