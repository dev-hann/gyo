import * as path from 'path';
import ora from 'ora';
import type { GyoConfig } from '../../services/config.service';
import { loadConfig } from '../../services/config.service';
import { logger } from '../../utils/logger';
import { pathExists } from '../../utils/fs';
import { GyoError, getErrorMessage } from '../../core/index';

export interface CommandOption {
  flags: string;
  description: string;
  default?: string | boolean;
  /** Turns what the user typed into the value the command receives. */
  parse?: (value: string) => unknown;
}

export interface CommandMeta {
  name: string;
  description: string;
  /** Positional arguments, as Commander spells them: `'<platform>'`, `'[platform]'`. */
  arguments?: string;
  options?: CommandOption[];
}

export interface BaseCommandOptions {
  verbose?: boolean;
}

export abstract class BaseCommand<T extends BaseCommandOptions = BaseCommandOptions> {
  protected options: T;
  protected spinner: ora.Ora;
  protected config: GyoConfig | null;
  protected projectPath: string;

  constructor() {
    this.options = { verbose: undefined } as T;
    this.spinner = ora();
    this.config = null;
    this.projectPath = process.cwd();
  }

  abstract getMeta(): CommandMeta;

  /** The positional arguments of the invocation, in the order of `getMeta().arguments`. */
  setPositionalArgs(_args: string[]): void {}

  /** Merges into what the command already received: the order of the two setters does not matter. */
  setOptions(options: T): void {
    this.options = { ...this.options, ...options };
    if (options.verbose !== undefined) {
      logger.setVerbose(options.verbose);
    }
  }

  async execute(): Promise<void> {
    try {
      await this.beforeRun();
      await this.run();
    } catch (error) {
      await this.handleError(error);
    }
  }

  protected abstract run(): Promise<void>;

  protected async beforeRun(): Promise<void> {}

  protected async loadConfiguration(): Promise<void> {
    this.config = await loadConfig(this.projectPath);
  }

  protected async requireGyoProject(): Promise<void> {
    const configPath = path.join(this.projectPath, 'gyo.config.json');
    if (!(await pathExists(configPath))) {
      throw new GyoError(
        `Not a gyo project (gyo.config.json not found in ${this.projectPath}).\n  Run 'gyo create <project-name>' to create a new project.`
      );
    }
  }

  /**
   * Reports `error` once and rethrows it. A spinner that never started is
   * left alone: there is nothing to mark as failed.
   */
  protected async handleError(error: unknown): Promise<void> {
    if (this.spinner.isSpinning) {
      this.spinner.fail('Command failed');
    }
    logger.error(getErrorMessage(error));
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
    if (error instanceof GyoError) {
      throw error;
    }
    throw new GyoError(getErrorMessage(error), 1, {
      cause: error,
    });
  }

  protected startSpinner(text: string): void {
    this.spinner.start(text);
  }

  protected updateSpinner(text: string): void {
    this.spinner.text = text;
  }

  protected succeedSpinner(text?: string): void {
    this.spinner.succeed(text);
  }

  protected failSpinner(text?: string): void {
    this.spinner.fail(text);
  }

  protected warnSpinner(text?: string): void {
    this.spinner.warn(text);
  }

  protected stopSpinner(): void {
    this.spinner.stop();
  }
}
