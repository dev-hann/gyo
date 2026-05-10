import type { CommandMeta, Platform, PlatformCommandOptions } from './base/index';
import { PlatformCommand } from './base/index';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../core/index';

export class DebugCommand extends PlatformCommand<PlatformCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: 'debug <platform>',
      description: 'Launch debugger for the specified platform',
      positionalHandler: 'platform',
    };
  }

  protected getValidPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  protected async run(): Promise<void> {
    if (this.platform === 'android') {
      await this.showAndroidDebugInfo();
    } else {
      this.showIOSDebugInfo();
    }
  }

  private async showAndroidDebugInfo(): Promise<void> {
    const open = (await import('open')).default;

    logger.info('Opening Chrome DevTools for Android debugging...\n');
    logger.info('📌 Steps:');
    logger.info('  1. Make sure your Android device is connected via USB');
    logger.info('  2. Enable USB debugging on your device');
    logger.info('  3. Run your app with `gyo run`');
    logger.info('  4. Chrome DevTools will open automatically\n');

    logger.info('Opening chrome://inspect...');

    try {
      await open('chrome://inspect');
      logger.success('\n✓ Chrome DevTools opened!');
      logger.info('\nIn Chrome:');
      logger.info('  • Click "inspect" under your device');
      logger.info('  • Use Console, Elements, Network tabs as usual');
    } catch (error) {
      const message = getErrorMessage(error);
      logger.debug(`Failed to open Chrome: ${message}`);
      logger.warn('\nCould not auto-open Chrome. Please manually navigate to:');
      logger.info('  chrome://inspect');
    }
  }

  private showIOSDebugInfo(): void {
    logger.info('iOS Debugging with Safari Web Inspector\n');
    logger.info('📌 Steps:');
    logger.info('  1. Connect your iOS device via USB or use Simulator');
    logger.info('  2. Run your app with `gyo run`');
    logger.info('  3. Open Safari on your Mac');
    logger.info('  4. Enable Develop menu:');
    logger.info('     Safari > Preferences > Advanced > Show Develop menu');
    logger.info('  5. Develop > [Your Device] > [Your App]\n');

    logger.info('Note: iOS debugging requires:');
    logger.info('  • macOS with Safari');
    logger.info('  • Physical device or iOS Simulator');
    logger.info('  • Web Inspector enabled on device (Settings > Safari > Advanced)');
  }
}
