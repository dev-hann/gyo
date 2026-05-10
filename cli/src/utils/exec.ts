import type { SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import { logger } from './logger';
import { getErrorMessage, ToolRequiredError } from '../core/errors';

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

    let onStdoutData: ((data: Buffer) => void) | null = null;
    let onStderrData: ((data: Buffer) => void) | null = null;
    let onClose: ((code: number | null) => void) | null = null;
    let onError: ((error: Error) => void) | null = null;

    const removeListeners = (): void => {
      if (onStdoutData) {
        proc.stdout?.off('data', onStdoutData);
      }
      if (onStderrData) {
        proc.stderr?.off('data', onStderrData);
      }
      if (onClose) {
        proc.off('close', onClose);
      }
      if (onError) {
        proc.off('error', onError);
      }
    };

    // Handle timeout
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          try {
            proc.kill();
          } catch (killError) {
            const message = getErrorMessage(killError);
            logger.debug(`Failed to kill process: ${message}`);
            if (killError instanceof Error && killError.stack && process.env.DEBUG) {
              logger.debug(killError.stack);
            }
          }
          removeListeners();
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
      onStdoutData = (data: Buffer) => {
        const output = data.toString();
        stdout += output;
        if (options.stdio === 'inherit' || logger.isVerbose()) {
          process.stdout.write(output);
        }
      };
      proc.stdout.on('data', onStdoutData);
    }

    if (proc.stderr) {
      onStderrData = (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        if (options.stdio === 'inherit' || logger.isVerbose()) {
          process.stderr.write(output);
        }
      };
      proc.stderr.on('data', onStderrData);
    }

    onClose = (code: number | null) => {
      removeListeners();
      done({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
      });
    };
    proc.on('close', onClose);

    onError = (error: Error) => {
      removeListeners();
      logger.error(`Failed to execute command: ${error.message}`);
      done({
        success: false,
        stdout: stdout.trim(),
        stderr: error.message,
        code: null,
      });
    };
    proc.on('error', onError);
  });
}

export const YAML_ERROR_TYPE_MISMATCH = 'typeMismatch';
export const YAML_ERROR_DECODE_SCALAR = 'Expected to decode Scalar';

export async function checkCommandExists(command: string): Promise<boolean> {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = await executeCommand(checker, [command], { stdio: 'pipe' });
  return result.success;
}

export async function requireTool(name: string, hint: string): Promise<void> {
  if (!(await checkCommandExists(name))) {
    throw new ToolRequiredError(name, hint);
  }
}

export function showYAMLParsingError(errorOutput: string): void {
  const hasYamlError =
    errorOutput.includes(YAML_ERROR_TYPE_MISMATCH) ||
    errorOutput.includes(YAML_ERROR_DECODE_SCALAR);

  if (!hasYamlError) {
    logger.error(errorOutput);
    return;
  }

  const lines = [
    'YAML parsing error in xtool.yml or project.yml',
    'Common issues:',
    '  1. bundleID should be a simple string value, not a mapping',
    '     ✓ Correct:   bundleID: com.example.app',
    '     ✗ Wrong:     bundleID:',
    '                     key: value',
    '  2. Check for unintended indentation or special characters',
    '',
    'Full error:',
    errorOutput,
  ];
  logger.error(lines.join('\n'));
}
