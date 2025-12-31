"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDoctorCommand = registerDoctorCommand;
const logger_1 = require("../utils/logger");
const exec_1 = require("../utils/exec");
function registerDoctorCommand(program) {
    program
        .command('doctor')
        .description('Check your environment for required dependencies')
        .action(async () => {
        await runDoctor();
    });
}
async function runDoctor() {
    logger_1.logger.info('Running gyo environment checks...\n');
    const results = [];
    // Node.js check
    results.push(await checkNodeJS());
    // npm check
    results.push(await checkNPM());
    // Git check
    results.push(await checkGit());
    // Android checks
    logger_1.logger.info('\nAndroid Development:');
    results.push(await checkAndroidSDK());
    results.push(await checkADB());
    results.push(await checkGradle());
    // iOS checks
    logger_1.logger.info('\niOS Development:');
    results.push(await checkSwift());
    results.push(await checkXtool());
    results.push(await checkLibimobiledevice());
    // Desktop checks
    logger_1.logger.info('\nDesktop Development:');
    results.push(await checkElectron());
    // Print summary
    logger_1.logger.info('\n' + '='.repeat(50));
    logger_1.logger.info('Summary:\n');
    const passed = results.filter(r => r.passed && !r.optional).length;
    const total = results.filter(r => !r.optional).length;
    const optional = results.filter(r => r.optional);
    results.forEach(result => {
        if (result.passed) {
            logger_1.logger.success(`${result.name}: ${result.message}`);
        }
        else {
            if (result.optional) {
                logger_1.logger.warn(`${result.name}: ${result.message} (optional)`);
            }
            else {
                logger_1.logger.error(`${result.name}: ${result.message}`);
            }
        }
    });
    logger_1.logger.info('\n' + '='.repeat(50));
    logger_1.logger.info(`\nPassed: ${passed}/${total} required checks`);
    if (optional.length > 0) {
        const passedOptional = optional.filter(r => r.passed).length;
        logger_1.logger.info(`Optional: ${passedOptional}/${optional.length} checks`);
    }
    if (passed === total) {
        logger_1.logger.success('\nYour environment is ready for gyo development!');
    }
    else {
        logger_1.logger.warn('\nSome checks failed. Please fix the issues above.');
    }
}
async function checkNodeJS() {
    const exists = await (0, exec_1.checkCommandExists)('node');
    if (!exists) {
        return {
            name: 'Node.js',
            passed: false,
            message: 'Not installed. Visit https://nodejs.org'
        };
    }
    const result = await (0, exec_1.executeCommand)('node', ['--version'], { stdio: 'pipe' });
    const version = result.stdout.trim();
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
    if (majorVersion >= 18) {
        return {
            name: 'Node.js',
            passed: true,
            message: `${version} installed`
        };
    }
    else {
        return {
            name: 'Node.js',
            passed: false,
            message: `${version} installed (requires v18 or higher)`
        };
    }
}
async function checkNPM() {
    const exists = await (0, exec_1.checkCommandExists)('npm');
    if (!exists) {
        return {
            name: 'npm',
            passed: false,
            message: 'Not installed'
        };
    }
    const result = await (0, exec_1.executeCommand)('npm', ['--version'], { stdio: 'pipe' });
    return {
        name: 'npm',
        passed: true,
        message: `v${result.stdout.trim()} installed`
    };
}
async function checkGit() {
    const exists = await (0, exec_1.checkCommandExists)('git');
    if (!exists) {
        return {
            name: 'Git',
            passed: false,
            message: 'Not installed',
            optional: true
        };
    }
    const result = await (0, exec_1.executeCommand)('git', ['--version'], { stdio: 'pipe' });
    return {
        name: 'Git',
        passed: true,
        message: result.stdout.trim(),
        optional: true
    };
}
async function checkAndroidSDK() {
    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (!androidHome) {
        return {
            name: 'Android SDK',
            passed: false,
            message: 'ANDROID_HOME not set',
            optional: true
        };
    }
    return {
        name: 'Android SDK',
        passed: true,
        message: `Found at ${androidHome}`,
        optional: true
    };
}
async function checkADB() {
    const exists = await (0, exec_1.checkCommandExists)('adb');
    if (!exists) {
        return {
            name: 'ADB',
            passed: false,
            message: 'Not found in PATH',
            optional: true
        };
    }
    const result = await (0, exec_1.executeCommand)('adb', ['--version'], { stdio: 'pipe' });
    return {
        name: 'ADB',
        passed: true,
        message: 'Installed',
        optional: true
    };
}
async function checkGradle() {
    const exists = await (0, exec_1.checkCommandExists)('gradle');
    return {
        name: 'Gradle',
        passed: exists,
        message: exists ? 'Installed' : 'Not found (will use gradlew)',
        optional: true
    };
}
async function checkSwift() {
    const exists = await (0, exec_1.checkCommandExists)('swift');
    if (!exists) {
        return {
            name: 'Swift',
            passed: false,
            message: 'Not installed. Required for iOS development',
            optional: true
        };
    }
    const result = await (0, exec_1.executeCommand)('swift', ['--version'], { stdio: 'pipe' });
    const versionMatch = result.stdout.match(/Swift version ([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : 'Installed';
    return {
        name: 'Swift',
        passed: true,
        message: `Version ${version}`,
        optional: true
    };
}
async function checkXtool() {
    const exists = await (0, exec_1.checkCommandExists)('xtool');
    if (!exists) {
        return {
            name: 'xtool',
            passed: false,
            message: 'Not installed. Visit https://xtool.sh for cross-platform iOS builds',
            optional: true
        };
    }
    const result = await (0, exec_1.executeCommand)('xtool', ['--version'], { stdio: 'pipe' });
    const version = result.stdout.trim();
    return {
        name: 'xtool',
        passed: true,
        message: version || 'Installed',
        optional: true
    };
}
async function checkLibimobiledevice() {
    const exists = await (0, exec_1.checkCommandExists)('idevice_id');
    if (!exists) {
        return {
            name: 'libimobiledevice',
            passed: false,
            message: 'Not installed. Required for iOS device communication (idevicesyslog, etc.)',
            optional: true
        };
    }
    // Check multiple tools
    const tools = ['idevice_id', 'ideviceinfo', 'idevicesyslog', 'ideviceimagemounter'];
    const installedTools = [];
    for (const tool of tools) {
        if (await (0, exec_1.checkCommandExists)(tool)) {
            installedTools.push(tool);
        }
    }
    return {
        name: 'libimobiledevice',
        passed: true,
        message: `Installed (${installedTools.length}/${tools.length} tools available)`,
        optional: true
    };
}
async function checkElectron() {
    return {
        name: 'Electron/Tauri',
        passed: true,
        message: 'Will be installed per-project',
        optional: true
    };
}
//# sourceMappingURL=doctor.js.map