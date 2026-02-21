import ora from 'ora';
import { logger } from './logger.js';
import { GyoError, ConfigNotFoundError } from './errors.js';
import { pathExists } from './fs.js';
import * as path from 'path';

export interface SpinnerOptions {
  text?: string;
  successText?: string;
  failText?: string;
}

export async function withSpinner<T>(
  text: string,
  fn: (spinner: ora.Ora) => Promise<T>
): Promise<T> {
  const spinner = ora(text).start();
  try {
    const result = await fn(spinner);
    return result;
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function withSpinnerStep<T>(
  text: string,
  fn: () => Promise<T>,
  successText?: string
): Promise<T> {
  const spinner = ora(text).start();
  try {
    const result = await fn();
    spinner.succeed(successText || text);
    return result;
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export function getGradlew(): string {
  return process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
}

export async function validateGyoProject(projectPath: string): Promise<void> {
  const libPath = path.join(projectPath, 'lib');
  const configPath = path.join(projectPath, 'gyo.config.json');

  if (!(await pathExists(libPath))) {
    throw new GyoError('lib/ directory not found. Are you in a Gyo project?');
  }

  if (!(await pathExists(configPath))) {
    throw new ConfigNotFoundError();
  }
}

export function handleCommandError(error: unknown): never {
  if (error instanceof GyoError) {
    throw error;
  }
  
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  
  if (error instanceof Error && error.stack && logger.isVerbose()) {
    logger.verbose(error.stack);
  }
  
  throw new GyoError(message);
}

export function suggestNextSteps(steps: string[]): void {
  logger.log('');
  logger.info("What's next:");
  for (const step of steps) {
    logger.info(`  • ${step}`);
  }
  logger.log('');
}
