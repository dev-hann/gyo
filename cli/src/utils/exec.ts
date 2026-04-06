import { spawn, SpawnOptions } from 'child_process';
import { logger } from './logger';

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface ExecOptions extends SpawnOptions {
  timeout?: number;
}

export function getGradlew(): string {
  return process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
}

export function executeCommand(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    let spawnArgs: [string, string[], ExecOptions];
    if (options.shell) {
      const combinedArgs =
        args.length > 0 ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ') : '';
      const combinedCommand = combinedArgs ? `${command} ${combinedArgs}` : command;
      spawnArgs = [combinedCommand, [], { ...options, shell: true }];
    } else {
      spawnArgs = [command, args, options];
    }
    const proc = spawn(...spawnArgs);

    let stdout = '';
    let stderr = '';
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const done = (result: ExecResult): void => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(result);
      }
    };

    // Handle timeout
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          proc.kill();
          done({
            success: false,
            stdout: stdout.trim(),
            stderr: `Command timed out after ${options.timeout}ms`,
            code: null,
          });
        }
      }, options.timeout);
    }

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Only output if verbose mode or stdio is 'inherit'
        if (options.stdio === 'inherit' || logger.isVerbose()) {
          process.stdout.write(output);
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Only output if verbose mode or stdio is 'inherit'
        if (options.stdio === 'inherit' || logger.isVerbose()) {
          process.stderr.write(output);
        }
      });
    }

    proc.on('close', (code) => {
      done({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
      });
    });

    proc.on('error', (error) => {
      logger.error(`Failed to execute command: ${error.message}`);
      done({
        success: false,
        stdout: stdout.trim(),
        stderr: error.message,
        code: null,
      });
    });
  });
}

export async function checkCommandExists(command: string): Promise<boolean> {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = await executeCommand(checker, [command], { stdio: 'pipe' });
  return result.success;
}

export function showYAMLParsingError(errorOutput: string): void {
  if (errorOutput.includes('typeMismatch') || errorOutput.includes('Expected to decode Scalar')) {
    const message = [
      'YAML parsing error in xtool.yml or project.yml',
      'Common issues:',
      '  1. bundleID should be a simple string value, not a mapping',
      '     ✓ Correct:   bundleID: com.example.app',
      '     ✗ Wrong:     bundleID:',
      '                    key: value',
      '  2. Check for unintended indentation or special characters',
      '',
      `Full error:\n${errorOutput}`,
    ].join('\n');
    logger.error(message);
    return;
  }
  logger.error(errorOutput);
}
