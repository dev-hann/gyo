import { createProgram } from './program';
import { logger } from './utils/logger';
import { GyoError, getErrorMessage } from './core/index';

const HELP_CODES = new Set(['commander.help', 'commander.outputHelp', 'commander.version']);

const program = createProgram();

function handleUnhandledRejection(error: unknown): void {
  // A command reports its own errors before it lets them get here.
  if (error instanceof GyoError) {
    process.exit(error.exitCode);
  }
  // Commander reports --help and --version as a rejected promise as well.
  if (
    error instanceof Error &&
    'code' in error &&
    HELP_CODES.has((error as { code: string }).code)
  ) {
    process.exit(0);
  }
  const errorMessage = getErrorMessage(error);
  logger.error(`Unexpected error: ${errorMessage}`);
  if (error instanceof Error && error.stack && process.env.DEBUG) {
    logger.debug(error.stack);
  }
  process.exit(1);
}

process.on('unhandledRejection', handleUnhandledRejection);

void program.parseAsync(process.argv).then(() => {
  if (!process.argv.slice(2).length) {
    logger.log('');
    logger.info('Welcome to gyo! Get started: gyo create my-app');
    logger.log('');
    program.outputHelp();
  }
});
