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
exports.registerBuildCommand = registerBuildCommand;
const path = __importStar(require("path"));
const ora_1 = __importDefault(require("ora"));
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const exec_1 = require("../utils/exec");
const fs_1 = require("../utils/fs");
function registerBuildCommand(program) {
    program
        .command('build <platform>')
        .description('Build the native application for the specified platform')
        .option('-r, --release', 'Build for release (production)', false)
        .action(async (platform, options) => {
        await buildPlatform(platform, options);
    });
}
async function buildPlatform(platform, options) {
    const spinner = (0, ora_1.default)(`Building for ${platform}...`).start();
    try {
        const validPlatforms = ['android', 'ios', 'desktop', 'lib'];
        if (!validPlatforms.includes(platform)) {
            spinner.fail(`Invalid platform: ${platform}`);
            logger_1.logger.error(`Valid platforms are: ${validPlatforms.join(', ')}`);
            process.exit(1);
        }
        const config = await (0, config_1.loadConfig)();
        if (!config) {
            spinner.fail('Failed to load gyo.config.json');
            process.exit(1);
        }
        const platformKey = platform;
        if (config.platforms[platformKey] && !config.platforms[platformKey]?.enabled) {
            spinner.fail(`Platform ${platform} is not enabled in gyo.config.json`);
            process.exit(1);
        }
        spinner.text = 'Building lib assets...';
        const libPath = path.join(process.cwd(), 'lib');
        if (await (0, fs_1.pathExists)(libPath)) {
            const libBuildResult = await (0, exec_1.executeCommand)('npm', ['run', 'build'], {
                cwd: libPath,
                stdio: 'pipe'
            });
            if (!libBuildResult.success) {
                spinner.fail('Lib build failed');
                logger_1.logger.error(libBuildResult.stderr);
                process.exit(1);
            }
            spinner.succeed('Lib assets built successfully');
        }
        else {
            logger_1.logger.warn('Lib directory not found, skipping lib build');
        }
        if (platform === 'lib') {
            logger_1.logger.success('Lib build complete!');
            return;
        }
        spinner.start(`Building ${platform} app...`);
        switch (platform) {
            case 'android':
                await buildAndroid(options.release, spinner);
                break;
            case 'ios':
                await buildIOS(options.release, spinner);
                break;
            case 'desktop':
                await buildDesktop(options.release, spinner);
                break;
        }
    }
    catch (error) {
        spinner.fail(`Build failed: ${error}`);
        logger_1.logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
async function buildAndroid(release, spinner) {
    const androidPath = path.join(process.cwd(), 'android');
    if (!(await (0, fs_1.pathExists)(androidPath))) {
        spinner.fail('Android project not found');
        logger_1.logger.error('Run: gyo init android');
        process.exit(1);
    }
    const task = release ? 'assembleRelease' : 'assembleDebug';
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    spinner.text = `Running ${task}...`;
    const result = await (0, exec_1.executeCommand)(gradlew, [task], {
        cwd: androidPath,
        stdio: 'inherit'
    });
    if (result.success) {
        spinner.succeed('Android build complete!');
        const apkPath = release
            ? 'android/app/build/outputs/apk/release/app-release.apk'
            : 'android/app/build/outputs/apk/debug/app-debug.apk';
        logger_1.logger.info(`APK location: ${apkPath}`);
    }
    else {
        spinner.fail('Android build failed');
        process.exit(1);
    }
}
async function buildIOS(release, spinner) {
    const iosPath = path.join(process.cwd(), 'ios');
    if (!(await (0, fs_1.pathExists)(iosPath))) {
        spinner.fail('iOS project not found');
        logger_1.logger.error('Run: gyo init ios');
        process.exit(1);
    }
    if (!(await (0, exec_1.checkCommandExists)('xtool'))) {
        spinner.fail('xtool not found');
        logger_1.logger.error('Install xtool: https://xtool.sh');
        process.exit(1);
    }
    const configuration = release ? 'Release' : 'Debug';
    spinner.text = `Building iOS (${configuration})...`;
    const result = await (0, exec_1.executeCommand)('xtool', ['dev', '--no-run'], {
        cwd: iosPath,
        stdio: 'inherit'
    });
    if (result.success) {
        spinner.succeed('iOS build complete!');
    }
    else {
        spinner.fail('iOS build failed');
        process.exit(1);
    }
}
async function buildDesktop(release, spinner) {
    const desktopPath = path.join(process.cwd(), 'desktop');
    if (!(await (0, fs_1.pathExists)(desktopPath))) {
        spinner.fail('Desktop project not found');
        logger_1.logger.error('Run: gyo init desktop');
        process.exit(1);
    }
    spinner.text = 'Building desktop app...';
    // Assuming Electron or Tauri
    const result = await (0, exec_1.executeCommand)('npm', ['run', 'build'], {
        cwd: desktopPath,
        stdio: 'inherit'
    });
    if (result.success) {
        spinner.succeed('Desktop build complete!');
    }
    else {
        spinner.fail('Desktop build failed');
        process.exit(1);
    }
}
//# sourceMappingURL=build.js.map