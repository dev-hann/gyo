"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommand = executeCommand;
exports.checkCommandExists = checkCommandExists;
const child_process_1 = require("child_process");
const logger_1 = require("./logger");
function executeCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
        logger_1.logger.debug(`Executing: ${command} ${args.join(' ')}`);
        const proc = (0, child_process_1.spawn)(command, args, {
            ...options,
            shell: true
        });
        let stdout = '';
        let stderr = '';
        if (proc.stdout) {
            proc.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                if (options.stdio !== 'inherit') {
                    process.stdout.write(output);
                }
            });
        }
        if (proc.stderr) {
            proc.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                if (options.stdio !== 'inherit') {
                    process.stderr.write(output);
                }
            });
        }
        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                code
            });
        });
        proc.on('error', (error) => {
            logger_1.logger.error(`Failed to execute command: ${error.message}`);
            resolve({
                success: false,
                stdout: stdout.trim(),
                stderr: error.message,
                code: null
            });
        });
    });
}
async function checkCommandExists(command) {
    const result = await executeCommand('which', [command], { stdio: 'pipe' });
    return result.success;
}
//# sourceMappingURL=exec.js.map