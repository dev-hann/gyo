import { BaseCommand, CommandMeta, BaseCommandOptions } from './base/index';
import { logger } from '../utils/logger';
import { getAllDevices, Device } from '../services/device.service';
import { GyoError, getErrorMessage } from '../core/index';

interface SystemError extends Error {
  code: string;
}

function isSystemError(error: unknown): error is SystemError {
  return (
    error instanceof Error && 'code' in error && typeof (error as SystemError).code === 'string'
  );
}

interface DevicesCommandOptions extends BaseCommandOptions {
  json?: boolean;
}

export class DevicesCommand extends BaseCommand<DevicesCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: 'devices',
      description: 'List all available development devices (Android and iOS)',
      options: [{ flags: '--json', description: 'Output as JSON', default: false }],
    };
  }

  protected async run(): Promise<void> {
    this.startSpinner('Detecting devices...');

    try {
      const devices = await getAllDevices();
      this.stopSpinner();

      if (devices.length === 0) {
        logger.warn('No available devices found');
        this.showTroubleshootingInfo();
        return;
      }

      if (this.options.json) {
        logger.log(JSON.stringify(devices, null, 2));
      } else {
        this.displayDevicesTable(devices);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      this.stopSpinner();

      if (isSystemError(error)) {
        if (error.code === 'EACCES') {
          throw new GyoError('ADB permission denied. Run with sudo or check USB debugging.');
        }
        if (error.code === 'ENOENT') {
          throw new GyoError('adb not found. Install Android SDK.');
        }
      }

      throw new GyoError(message);
    }
  }

  private showTroubleshootingInfo(): void {
    logger.info('');
    logger.info('Troubleshooting:');
    logger.info('  - For Android: Ensure ADB is installed and a device/emulator is connected');
    logger.info(
      '  - For iOS: Ensure libimobiledevice-utils is installed and a device is connected'
    );
    logger.info('    Install on Linux: sudo apt install libimobiledevice-utils');
  }

  private displayDevicesTable(devices: Device[]): void {
    logger.log('');
    logger.success(`Found ${devices.length} available device(s):`);
    logger.log('');

    const columnWidths = this.calculateColumnWidths(devices);

    const header = [
      'Platform'.padEnd(columnWidths.platform),
      'ID'.padEnd(columnWidths.id),
      'Name/Model'.padEnd(columnWidths.name),
      'State'.padEnd(columnWidths.state),
    ].join('  ');

    logger.log(header);
    logger.log('-'.repeat(header.length));

    for (const device of devices) {
      const row = [
        device.platform.toUpperCase().padEnd(columnWidths.platform),
        device.id.padEnd(columnWidths.id),
        device.name.padEnd(columnWidths.name),
        device.state.padEnd(columnWidths.state),
      ].join('  ');

      logger.log(row);
    }

    logger.log('');
  }

  private calculateColumnWidths(devices: Device[]): {
    platform: number;
    id: number;
    name: number;
    state: number;
  } {
    return {
      platform: Math.max(8, ...devices.map((d) => d.platform.length)),
      id: Math.max(12, ...devices.map((d) => d.id.length)),
      name: Math.max(20, ...devices.map((d) => d.name.length)),
      state: Math.max(10, ...devices.map((d) => d.state.length)),
    };
  }
}
