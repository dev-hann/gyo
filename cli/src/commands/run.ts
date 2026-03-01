import inquirer from 'inquirer';
import { BaseCommand, CommandMeta, Platform } from './base/index.js';
import { AndroidRunCommand } from './run/AndroidRunCommand.js';
import { IOSRunCommand } from './run/IOSRunCommand.js';
import { getAllDevices, Device } from '../services/device.service.js';
import { logger } from '../utils/logger.js';
import { GyoError, InvalidPlatformError } from '../core/index.js';

interface RunCommandOptions {
  device?: string;
  profile: string;
  verbose?: boolean;
}

export class RunCommand extends BaseCommand<RunCommandOptions> {
  private platform: Platform = 'android';

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
    this.platform = selectedDevice.platform;

    const command = this.createCommand(selectedDevice);
    command.setOptions({
      ...this.options,
      device: selectedDevice.id,
    });
    await command.execute();
  }

  private showNoDevicesError(): void {
    logger.error('No devices found');
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
      logger.info(
        `Found 1 device. Automatically selecting '${devices[0].name}' (${devices[0].platform})`
      );
      return devices[0];
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

    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'deviceIndex',
        message: 'Select a device (enter number):',
        validate: (input: string): boolean | string => {
          const num = parseInt(input);
          if (isNaN(num) || num < 1 || num > devices.length) {
            return `Please enter a number between 1 and ${devices.length}`;
          }
          return true;
        },
      },
    ]);

    const selectedIndex = parseInt(answer.deviceIndex) - 1;
    return devices[selectedIndex];
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
