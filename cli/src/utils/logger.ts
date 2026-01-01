import chalk from 'chalk';

let verboseMode = false;

export const logger = {
  setVerbose: (verbose: boolean) => {
    verboseMode = verbose;
  },
  
  isVerbose: () => verboseMode,
  
  info: (message: string) => {
    console.log(chalk.blue('ℹ'), message);
  },
  
  success: (message: string) => {
    console.log(chalk.green('✓'), message);
  },
  
  warn: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },
  
  error: (message: string) => {
    console.log(chalk.red('✗'), message);
  },
  
  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('🐛'), message);
    }
  },
  
  verbose: (message: string) => {
    if (verboseMode) {
      console.log(chalk.gray(message));
    }
  },
  
  log: (message: string) => {
    console.log(message);
  }
};
