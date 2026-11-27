import type { ChildProcess, SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import { logger } from './logger';
import { getErrorMessage, ToolRequiredError } from '../core/errors';

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export function getGradlew(): string {
  return process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
}

/**
 * Runs a command to completion and returns what it printed. Output is
 * forwarded to the terminal when `stdio` is `inherit` or in verbose mode.
 */
export function executeCommand(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, options);

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const done = (result: ExecResult): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      removeListeners();
      resolve(result);
    };

    const show = (stream: 'stdout' | 'stderr', output: string): void => {
      if (options.stdio === 'inherit' || logger.isVerbose()) {
        (stream === 'stdout' ? process.stdout : process.stderr).write(output);
      }
    };

    const onStdoutData = (data: Buffer): void => {
      stdout += data.toString();
      show('stdout', data.toString());
    };

    const onStderrData = (data: Buffer): void => {
      stderr += data.toString();
      show('stderr', data.toString());
    };

    const onClose = (code: number | null): void => {
      done({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
      });
    };

    const onError = (error: Error): void => {
      logger.error(`Failed to execute command: ${error.message}`);
      done({ success: false, stdout: stdout.trim(), stderr: error.message, code: null });
    };

    const removeListeners = (): void => {
      proc.stdout?.off('data', onStdoutData);
      proc.stderr?.off('data', onStderrData);
      proc.off('close', onClose);
      proc.off('error', onError);
    };

    proc.stdout?.on('data', onStdoutData);
    proc.stderr?.on('data', onStderrData);
    proc.on('close', onClose);
    proc.on('error', onError);
  });
}

type Signals = Parameters<ChildProcess['kill']>[0];

/**
 * Signals a child together with everything it spawned. A child started
 * detached leads its own process group, so the negative pid reaches the
 * shell, the package manager and the server it started. A child without its
 * own group, such as a log process, is signalled directly.
 */
export function signalProcessTree(proc: ChildProcess, signal: Signals): void {
  const pid = proc.pid;
  if (!pid) {
    return;
  }

  const signalOrLog = (signalFn: () => void, description: string): boolean => {
    try {
      signalFn();
      return true;
    } catch (e) {
      logger.debug(`Failed to ${description}: ${getErrorMessage(e)}`);
      return false;
    }
  };

  if (!signalOrLog(() => process.kill(-pid, signal), `signal process group ${pid}`)) {
    signalOrLog(() => proc.kill(signal), `signal process ${pid}`);
  }
}

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
