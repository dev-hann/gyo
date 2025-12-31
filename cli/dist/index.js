#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const create_1 = require("./commands/create");
const build_1 = require("./commands/build");
const run_1 = require("./commands/run");
const clean_1 = require("./commands/clean");
const config_1 = require("./commands/config");
const doctor_1 = require("./commands/doctor");
const program = new commander_1.Command();
program
    .name('gyo')
    .description('CLI tool for the gyo framework - Bridge between web and native')
    .version('0.1.0');
(0, create_1.registerCreateCommand)(program);
(0, build_1.registerBuildCommand)(program);
(0, run_1.registerRunCommand)(program);
(0, clean_1.registerCleanCommand)(program);
(0, config_1.registerConfigCommand)(program);
(0, doctor_1.registerDoctorCommand)(program);
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map