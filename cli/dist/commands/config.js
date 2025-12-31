"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigCommand = registerConfigCommand;
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
function registerConfigCommand(program) {
    const config = program
        .command('config')
        .description('Manage gyo configuration');
    config
        .command('show')
        .description('Show current configuration')
        .action(async () => {
        await showConfig();
    });
    config
        .command('set <key> <value>')
        .description('Set a configuration value')
        .action(async (key, value) => {
        await setConfig(key, value);
    });
    config
        .command('get <key>')
        .description('Get a configuration value')
        .action(async (key) => {
        await getConfig(key);
    });
}
async function showConfig() {
    const config = await (0, config_1.loadConfig)();
    if (!config) {
        process.exit(1);
    }
    logger_1.logger.info('Current gyo configuration:\n');
    console.log(JSON.stringify(config, null, 2));
}
async function setConfig(key, value) {
    const config = await (0, config_1.loadConfig)();
    if (!config) {
        process.exit(1);
    }
    // Parse the key path (e.g., "platforms.android.enabled")
    const keys = key.split('.');
    let current = config;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
            logger_1.logger.error(`Invalid configuration key: ${key}`);
            process.exit(1);
        }
        current = current[keys[i]];
    }
    const lastKey = keys[keys.length - 1];
    // Parse value
    let parsedValue = value;
    if (value === 'true')
        parsedValue = true;
    else if (value === 'false')
        parsedValue = false;
    else if (!isNaN(Number(value)))
        parsedValue = Number(value);
    current[lastKey] = parsedValue;
    await (0, config_1.saveConfig)(config);
    logger_1.logger.success(`Set ${key} = ${parsedValue}`);
}
async function getConfig(key) {
    const config = await (0, config_1.loadConfig)();
    if (!config) {
        process.exit(1);
    }
    const keys = key.split('.');
    let current = config;
    for (const k of keys) {
        if (!(k in current)) {
            logger_1.logger.error(`Configuration key not found: ${key}`);
            process.exit(1);
        }
        current = current[k];
    }
    logger_1.logger.info(`${key} = ${JSON.stringify(current, null, 2)}`);
}
//# sourceMappingURL=config.js.map