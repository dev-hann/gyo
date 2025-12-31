"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDevCommand = registerDevCommand;
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const fs_1 = require("../utils/fs");
function registerDevCommand(program) {
    program
        .command('dev')
        .description('Start development server and watch for changes')
        .option('-p, --platform <platform>', 'Platform to run (android, ios, desktop)', 'web')
        .action(async (options) => {
        await startDev(options);
    });
}
async function startDev(options) {
    try {
        logger_1.logger.info('Starting gyo development mode...');
        // Load config
        const config = await (0, config_1.loadConfig)();
        if (!config) {
            logger_1.logger.error('Failed to load gyo.config.json');
            process.exit(1);
        }
        // Check if web directory exists
        const webPath = path.join(process.cwd(), 'web');
        if (!(await (0, fs_1.pathExists)(webPath))) {
            logger_1.logger.error('Web directory not found. Make sure you are in a gyo project directory.');
            process.exit(1);
        }
        // Check if node_modules exists, install if not
        const nodeModulesPath = path.join(webPath, 'node_modules');
        if (!(await (0, fs_1.pathExists)(nodeModulesPath))) {
            logger_1.logger.info('Dependencies not found. Installing...');
            const { executeCommand } = require('../utils/exec');
            const installResult = await executeCommand('npm', ['install'], {
                cwd: webPath,
                stdio: 'inherit'
            });
            if (!installResult.success) {
                logger_1.logger.error('Failed to install dependencies');
                process.exit(1);
            }
            logger_1.logger.success('Dependencies installed successfully');
        }
        // Start web dev server
        logger_1.logger.info('Starting web development server...');
        const webServer = await startWebDevServer(webPath, config.devServer?.port || 3000);
        if (!webServer) {
            logger_1.logger.error('Failed to start web development server');
            process.exit(1);
        }
        logger_1.logger.success(`Web server running at http://localhost:${config.devServer?.port || 3000}`);
        if (options.platform !== 'web') {
            logger_1.logger.info(`Platform: ${options.platform}`);
            logger_1.logger.warn('Native platform support is coming soon!');
            logger_1.logger.info('For now, you can:');
            logger_1.logger.info('  1. Open the web app in your browser');
            logger_1.logger.info('  2. Build and run the native app separately with:');
            logger_1.logger.info(`     gyo build ${options.platform}`);
            logger_1.logger.info(`     gyo run ${options.platform}`);
        }
        // Keep the process running
        process.on('SIGINT', () => {
            logger_1.logger.info('\nShutting down development server...');
            if (webServer) {
                webServer.kill();
            }
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error(`Development mode failed: ${error}`);
        process.exit(1);
    }
}
async function startWebDevServer(webPath, port) {
    return new Promise((resolve) => {
        // Check if package.json exists
        const packageJsonPath = path.join(webPath, 'package.json');
        const fs = require('fs-extra');
        if (!fs.existsSync(packageJsonPath)) {
            logger_1.logger.warn('package.json not found in web directory');
            logger_1.logger.info('Run: cd web && npm install');
            resolve(null);
            return;
        }
        // Start the dev server
        const devServer = (0, child_process_1.spawn)('npm', ['run', 'dev'], {
            cwd: webPath,
            stdio: 'inherit',
            shell: true
        });
        devServer.on('error', (error) => {
            logger_1.logger.error(`Failed to start dev server: ${error.message}`);
            resolve(null);
        });
        // Give it some time to start
        setTimeout(() => {
            resolve(devServer);
        }, 2000);
    });
}
//# sourceMappingURL=dev.js.map