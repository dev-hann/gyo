import { spawn, SpawnOptions } from 'child_process';
import { logger } from './logger.js';

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export function executeCommand(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      ...options,
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
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
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code
      });
    });
    
    proc.on('error', (error) => {
      logger.error(`Failed to execute command: ${error.message}`);
      resolve({
        success: false,
        stdout: stdout.trim(),
        stderr: error.message,
        code: null
      });
    });
  });
}

export async function checkCommandExists(command: string): Promise<boolean> {
  const result = await executeCommand('which', [command], { stdio: 'pipe' });
  return result.success;
}
