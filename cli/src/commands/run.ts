import inquirer from 'inquirer';
import { BaseCommand, CommandMeta } from './base/index';
import { AndroidRunCommand } from './run/AndroidRunCommand';
import { IOSRunCommand } from './run/IOSRunCommand';
import { getAllDevices, Device } from '../services/device.service';
import { logger } from '../utils/logger';
import { GyoError, InvalidPlatformError } from '../core/index';

interface RunCommandOptions {
  device?: string;
  profile: string;
  verbose?: boolean;
  port?: number;
}

export class RunCommand extends BaseCommand<RunCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: 'run',
      description: 'Run the application on a connected device',
      options: [
        { flags: '-d, --device <device>', description: 'Specific device ID to run on' },
        {
          flags: '-p, --profile <profile>',
          description: 'Build profile to use',
          default: 'development',
        },
        { flags: '-v, --verbose', description: 'Show detailed logs' },
        {
          flags: '--port <number>',
          description: 'Override the development server port',
        },
      ],
    };
  }

  protected async run(): Promise<void> {
    const devices = await getAllDevices();

    if (devices.length === 0) {
      this.showNoDevicesError();
      throw new GyoError('No devices found');
    }

    const selectedDevice = await this.selectDevice(devices);

    const command = this.createCommand(selectedDevice);
    command.setOptions({
      ...this.options,
      device: selectedDevice.id,
    });
    await command.runDirectly();
  }

  private showNoDevicesError(): void {
    logger.error('Please connect a device or start an emulator');
    logger.info('');
    logger.info('Troubleshooting:');
    logger.info('  - For Android: Ensure ADB is installed and a device/emulator is connected');
    logger.info(
      '  - For iOS: Ensure libimobiledevice-utils is installed and a device is connected'
    );
    logger.info('    Install on Linux: sudo apt install libimobiledevice-utils');
  }

  private async selectDevice(devices: Device[]): Promise<Device> {
    if (this.options.device) {
      const device = devices.find((d: Device) => d.id === this.options.device);
      if (!device) {
        logger.error(`Device '${this.options.device}' not found`);
        logger.error('Available devices:');
        devices.forEach((d: Device) => logger.info(`  - ${d.platform}: ${d.name} (${d.id})`));
        throw new GyoError(`Device '${this.options.device}' not found`);
      }
      logger.info(`Using specified device: ${device.name} (${device.platform})`);
      return device;
    }

    if (devices.length === 1) {
      const device = devices[0];
      logger.info(`Found 1 device. Automatically selecting '${device.name}' (${device.platform})`);
      return device;
    }

    return this.promptDeviceSelection(devices);
  }

  private async promptDeviceSelection(devices: Device[]): Promise<Device> {
    logger.log('');
    logger.success(`Found ${devices.length} devices:`);
    logger.log('');

    devices.forEach((device: Device, index: number) => {
      logger.log(`  ${index + 1}. [${device.platform.toUpperCase()}] ${device.name}`);
      logger.log(`     ID: ${device.id}`);
    });

    logger.log('');

    const choices = devices.map((device: Device, index: number) => ({
      name: `[${device.platform.toUpperCase()}] ${device.name} (${device.id})`,
      value: index,
    }));

    const answer = await inquirer.prompt([
      {
        type: 'select' as const,
        name: 'deviceIndex',
        message: 'Select a device:',
        choices,
      },
    ]);

    return devices[answer.deviceIndex];
  }

  private createCommand(device: Device): AndroidRunCommand | IOSRunCommand {
    switch (device.platform) {
      case 'android':
        return new AndroidRunCommand();
      case 'ios':
        return new IOSRunCommand();
      default:
        throw new InvalidPlatformError(device.platform, ['android', 'ios']);
    }
  }
}
