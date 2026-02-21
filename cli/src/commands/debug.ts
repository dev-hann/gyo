import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { InvalidPlatformError } from '../utils/errors.js';

const SUPPORTED_PLATFORMS = ['android', 'ios'];

export function registerDebugCommand(program: Command): void {
  program
    .command('debug <platform>')
    .description('Launch debugger for the specified platform')
    .action(async (platform: string) => {
      await runDebug(platform);
    });
}

async function runDebug(platform: string): Promise<void> {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new InvalidPlatformError(platform, SUPPORTED_PLATFORMS);
  }

  if (platform === 'android') {
    showAndroidDebugInfo();
  } else if (platform === 'ios') {
    showIOSDebugInfo();
  }
}

async function showAndroidDebugInfo(): Promise<void> {
  const open = (await import('open')).default;
  
  logger.info('Opening Chrome DevTools for Android debugging...\n');
  logger.info('📌 Steps:');
  logger.info('  1. Make sure your Android device is connected via USB');
  logger.info('  2. Enable USB debugging on your device');
  logger.info('  3. Run your app with `gyo run android`');
  logger.info('  4. Chrome DevTools will open automatically\n');

  logger.info('Opening chrome://inspect...');

  try {
    await open('chrome://inspect');
    logger.success('\n✓ Chrome DevTools opened!');
    logger.info('\nIn Chrome:');
    logger.info('  • Click "inspect" under your device');
    logger.info('  • Use Console, Elements, Network tabs as usual');
  } catch {
    logger.warn('\nCould not auto-open Chrome. Please manually navigate to:');
    logger.info('  chrome://inspect');
  }
}

function showIOSDebugInfo(): void {
  logger.info('iOS Debugging with Safari Web Inspector\n');
  logger.info('📌 Steps:');
  logger.info('  1. Connect your iOS device via USB or use Simulator');
  logger.info('  2. Run your app with `gyo run ios`');
  logger.info('  3. Open Safari on your Mac');
  logger.info('  4. Enable Develop menu:');
  logger.info('     Safari > Preferences > Advanced > Show Develop menu');
  logger.info('  5. Develop > [Your Device] > [Your App]\n');

  logger.info('Note: iOS debugging requires:');
  logger.info('  • macOS with Safari');
  logger.info('  • Physical device or iOS Simulator');
  logger.info('  • Web Inspector enabled on device (Settings > Safari > Advanced)');
}
