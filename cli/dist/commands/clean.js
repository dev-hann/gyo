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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCleanCommand = registerCleanCommand;
const path = __importStar(require("path"));
const ora_1 = __importDefault(require("ora"));
const logger_1 = require("../utils/logger");
const exec_1 = require("../utils/exec");
const fs_1 = require("../utils/fs");
function registerCleanCommand(program) {
    program
        .command('clean [platform]')
        .description('Clean build artifacts (android, ios, lib, or all)')
        .action(async (platform) => {
        await cleanPlatform(platform || 'all');
    });
}
async function cleanPlatform(platform) {
    const spinner = (0, ora_1.default)('Cleaning build artifacts...').start();
    try {
        const validPlatforms = ['android', 'ios', 'lib', 'all'];
        if (!validPlatforms.includes(platform)) {
            spinner.fail(`Invalid platform: ${platform}`);
            logger_1.logger.error(`Valid platforms are: ${validPlatforms.join(', ')}`);
            process.exit(1);
        }
        const platforms = platform === 'all' ? ['android', 'ios', 'lib'] : [platform];
        for (const p of platforms) {
            switch (p) {
                case 'android':
                    await cleanAndroid(spinner);
                    break;
                case 'ios':
                    await cleanIOS(spinner);
                    break;
                case 'lib':
                    await cleanLib(spinner);
                    break;
            }
        }
        spinner.succeed('Clean complete!');
    }
    catch (error) {
        spinner.fail(`Clean failed: ${error}`);
        logger_1.logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
async function cleanAndroid(spinner) {
    const androidPath = path.join(process.cwd(), 'android');
    if (!(await (0, fs_1.pathExists)(androidPath))) {
        logger_1.logger.warn('Android project not found, skipping');
        return;
    }
    spinner.text = 'Cleaning Android build...';
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    const cleanResult = await (0, exec_1.executeCommand)(gradlew, ['clean'], {
        cwd: androidPath,
        stdio: 'pipe'
    });
    if (!cleanResult.success) {
        logger_1.logger.warn('Android clean failed');
        logger_1.logger.error(cleanResult.stderr);
    }
    else {
        logger_1.logger.success('Android build cleaned');
    }
    // Also remove build directories
    const buildPath = path.join(androidPath, 'app/build');
    if (await (0, fs_1.pathExists)(buildPath)) {
        await (0, fs_1.removeDir)(buildPath);
    }
}
async function cleanIOS(spinner) {
    const iosPath = path.join(process.cwd(), 'ios');
    if (!(await (0, fs_1.pathExists)(iosPath))) {
        logger_1.logger.warn('iOS project not found, skipping');
        return;
    }
    spinner.text = 'Cleaning iOS build...';
    // Clean derived data
    const buildPath = path.join(iosPath, 'build');
    if (await (0, fs_1.pathExists)(buildPath)) {
        await (0, fs_1.removeDir)(buildPath);
        logger_1.logger.success('iOS build cleaned');
    }
    // Clean pods if exists
    const podsPath = path.join(iosPath, 'Pods');
    if (await (0, fs_1.pathExists)(podsPath)) {
        await (0, fs_1.removeDir)(podsPath);
        logger_1.logger.success('iOS Pods cleaned');
    }
}
async function cleanLib(spinner) {
    const libPath = path.join(process.cwd(), 'lib');
    if (!(await (0, fs_1.pathExists)(libPath))) {
        logger_1.logger.warn('Lib project not found, skipping');
        return;
    }
    spinner.text = 'Cleaning lib build...';
    // Remove dist directory
    const distPath = path.join(libPath, 'dist');
    if (await (0, fs_1.pathExists)(distPath)) {
        await (0, fs_1.removeDir)(distPath);
    }
    // Remove node_modules
    const nodeModulesPath = path.join(libPath, 'node_modules');
    if (await (0, fs_1.pathExists)(nodeModulesPath)) {
        await (0, fs_1.removeDir)(nodeModulesPath);
    }
    logger_1.logger.success('Lib build cleaned');
}
//# sourceMappingURL=clean.js.map