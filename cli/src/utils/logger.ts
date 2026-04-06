import chalk from 'chalk';

let verboseMode = false;
let testMode = process.env.NODE_ENV === 'test';

export const logger = {
  setVerbose: (verbose: boolean): void => {
    verboseMode = verbose;
  },

  resetVerbose: (): void => {
    verboseMode = false;
  },

  isVerbose: (): boolean => verboseMode,

  setTestMode: (mode: boolean): void => {
    testMode = mode;
  },

  isTestMode: (): boolean => testMode,

  info: (message: string): void => {
    console.log(chalk.blue('ℹ'), message);
  },

  success: (message: string): void => {
    console.log(chalk.green('✓'), message);
  },

  warn: (message: string): void => {
    console.log(chalk.yellow('⚠'), message);
  },

  error: (message: string): void => {
    if (!testMode) {
      console.log(chalk.red('✗'), message);
    }
  },

  debug: (message: string): void => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🐛'), message);
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
    console.log(chalk.blue('ℹ'), "What's next:");
    for (const step of steps) {
      console.log(chalk.blue('ℹ'), `  • ${step}`);
    }
    console.log('');
  },
};
