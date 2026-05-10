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

type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};

let currentLevel: LogLevel = 'info';

function resolveLevel(): LogLevel {
  if (process.env.DEBUG) return 'debug';
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[resolveLevel()];
}

export const logger = {
  setVerbose: (verbose: boolean): void => {
    currentLevel = verbose ? 'verbose' : 'info';
  },

  resetVerbose: (): void => {
    currentLevel = 'info';
  },

  isVerbose: (): boolean => LOG_LEVEL_PRIORITY[resolveLevel()] >= LOG_LEVEL_PRIORITY['verbose'],

  setLevel: (level: LogLevel): void => {
    currentLevel = level;
  },

  getLevel: (): LogLevel => resolveLevel(),

  info: (message: string): void => {
    if (shouldLog('info')) {
      console.log(chalk.blue(EMOJI.INFO), message);
    }
  },

  success: (message: string): void => {
    if (shouldLog('info')) {
      console.log(chalk.green(EMOJI.SUCCESS), message);
    }
  },

  warn: (message: string): void => {
    if (shouldLog('warn')) {
      console.log(chalk.yellow(EMOJI.WARNING), message);
    }
  },

  error: (message: string): void => {
    if (shouldLog('error')) {
      console.log(chalk.red(EMOJI.ERROR), message);
    }
  },

  debug: (message: string): void => {
    if (shouldLog('debug')) {
      console.log(chalk.gray(EMOJI.DEBUG), message);
    }
  },

  verbose: (message: string): void => {
    if (shouldLog('verbose')) {
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
