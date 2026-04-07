import chalk from 'chalk';

const EMOJI = {
  INFO: 'ℹ',
  SUCCESS: '✓',
  WARNING: '⚠',
  ERROR: '✗',
  DEBUG: '🐛',
  IOS: '📱',
} as const;

export { EMOJI };

let verboseMode = false;

export const logger = {
  setVerbose: (verbose: boolean): void => {
    verboseMode = verbose;
  },

  resetVerbose: (): void => {
    verboseMode = false;
  },

  isVerbose: (): boolean => verboseMode,

  info: (message: string): void => {
    console.log(chalk.blue(EMOJI.INFO), message);
  },

  success: (message: string): void => {
    console.log(chalk.green(EMOJI.SUCCESS), message);
  },

  warn: (message: string): void => {
    console.log(chalk.yellow(EMOJI.WARNING), message);
  },

  error: (message: string): void => {
    console.log(chalk.red(EMOJI.ERROR), message);
  },

  debug: (message: string): void => {
    if (process.env.DEBUG) {
      console.log(chalk.gray(EMOJI.DEBUG), message);
    }
  },

  verbose: (message: string): void => {
    if (verboseMode) {
      console.log(chalk.gray(message));
    }
  },

  log: (message: string): void => {
    console.log(message);
  },

  suggestNextSteps: (steps: string[]): void => {
    console.log('');
    console.log(chalk.blue(EMOJI.INFO), "What's next:");
    for (const step of steps) {
      console.log(chalk.blue(EMOJI.INFO), `  • ${step}`);
    }
    console.log('');
  },
};
