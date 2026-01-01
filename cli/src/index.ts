#!/usr/bin/env node

import { Command } from 'commander';
import { registerCreateCommand } from './commands/create';
import { registerBuildCommand } from './commands/build';
import { registerRunCommand } from './commands/run';
import { registerCleanCommand } from './commands/clean';
import { registerConfigCommand } from './commands/config';
import { registerDoctorCommand } from './commands/doctor';
import { registerDevicesCommand } from './commands/devices';

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
