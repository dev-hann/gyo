import { spawn, SpawnOptions } from 'child_process';
import { logger } from './logger';

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export function getGradlew(): string {
  return process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
}

export function executeCommand(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    // Combine command and args into a single string to avoid DEP0190 warning
    // when using shell: true with args array
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    const proc = spawn(fullCommand, [], {
      ...options,
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const done = (result: ExecResult): void => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

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
    logger.error('YAML parsing error in xtool.yml or project.yml');
    logger.error('Common issues:');
    logger.error('  1. bundleID should be a simple string value, not a mapping');
    logger.error('     ✓ Correct:   bundleID: com.example.app');
    logger.error('     ✗ Wrong:     bundleID:');
    logger.error('                    key: value');
    logger.error('  2. Check for unintended indentation or special characters');
    logger.error(`\nFull error:\n${errorOutput}`);
  } else {
    logger.error(errorOutput);
  }
}
