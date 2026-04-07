import * as path from 'path';
import ora from 'ora';
import { loadConfig, GyoConfig } from '../../services/config.service';
import { logger } from '../../utils/logger';
import { pathExists } from '../../utils/fs';
import { GyoError, getErrorMessage } from '../../core/index';

export interface CommandOption {
  flags: string;
  description: string;
  default?: string | boolean | string[];
}

export interface CommandMeta {
  name: string;
  description: string;
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

  setOptions(options: T): void {
    this.options = options;
    if (options.verbose) {
      logger.setVerbose(true);
    }
  }

  async execute(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.handleError(error);
    }
  }

  protected abstract run(): Promise<void>;

  protected async loadConfiguration(): Promise<void> {
    try {
      this.config = await loadConfig(this.projectPath);
    } catch (error) {
      this.spinner.fail('Failed to load gyo.config.json');
      logger.error(getErrorMessage(error));
      throw error;
    }
  }

  protected async requireGyoProject(): Promise<void> {
    const configPath = path.join(this.projectPath, 'gyo.config.json');
    if (!(await pathExists(configPath))) {
      throw new GyoError(
        `Not a gyo project (gyo.config.json not found in ${this.projectPath}).\n  Run 'gyo create <project-name>' to create a new project.`
      );
    }
  }

  protected handleError(error: unknown): void {
    this.spinner.fail('Command failed');
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

  protected infoSpinner(text?: string): void {
    this.spinner.info(text);
  }

  protected stopSpinner(): void {
    this.spinner.stop();
  }
}
