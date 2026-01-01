import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { Platform } from './common/AbstractPlatformCommand';
import { AndroidRunCommand } from './run/AndroidRunCommand';
import { IOSRunCommand } from './run/IOSRunCommand';
import { getAllDevices, Device } from '../utils/devices';
import { logger } from '../utils/logger';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run the application on a connected device')
    .option('-d, --device <device>', 'Specific device ID to run on')
    .option('-p, --profile <profile>', 'Build profile to use (development, production, etc.)', 'development')
    .action(async (options: { device?: string; profile?: string }) => {
      await runOnDevice(options);
    });
}

async function runOnDevice(options: { device?: string; profile?: string }): Promise<void> {
  const spinner = ora('Detecting devices...').start();

  try {
    // Detect all available devices
    const devices = await getAllDevices();

    if (devices.length === 0) {
      spinner.fail('No devices found');
      logger.error('Please connect a device or start an emulator');
      logger.info('');
      logger.info('Troubleshooting:');
      logger.info('  - For Android: Ensure ADB is installed and a device/emulator is connected');
      logger.info('  - For iOS: Ensure libimobiledevice-utils is installed and a device is connected');
      logger.info('    Install on Linux: sudo apt install libimobiledevice-utils');
      process.exit(1);
    }

    let selectedDevice: Device;

    // If device ID is specified, find it
    if (options.device) {
      const device = devices.find(d => d.id === options.device);
      if (!device) {
        spinner.fail(`Device '${options.device}' not found`);
        logger.error('Available devices:');
        devices.forEach(d => logger.info(`  - ${d.platform}: ${d.name} (${d.id})`));
        process.exit(1);
      }
      selectedDevice = device;
      spinner.stop();
      logger.info(`Using specified device: ${selectedDevice.name} (${selectedDevice.platform})`);
    } else if (devices.length === 1) {
      // Auto-select the only available device
      selectedDevice = devices[0];
      spinner.stop();
      logger.info(`Found 1 device. Automatically selecting '${selectedDevice.name}' (${selectedDevice.platform})`);
    } else {
      // Multiple devices - display list and prompt for number
      spinner.stop();
      logger.log('');
      logger.success(`Found ${devices.length} devices:`);
      logger.log('');

      // Display numbered list
      devices.forEach((device, index) => {
        logger.log(`  ${index + 1}. [${device.platform.toUpperCase()}] ${device.name}`);
        logger.log(`     ID: ${device.id}`);
      });

      logger.log('');

      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'deviceIndex',
          message: 'Select a device (enter number):',
          validate: (input: string) => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > devices.length) {
              return `Please enter a number between 1 and ${devices.length}`;
            }
            return true;
          }
        }
      ]);

      const selectedIndex = parseInt(answer.deviceIndex) - 1;
      selectedDevice = devices[selectedIndex];
    }

    // Determine platform and create appropriate command
    const platform: Platform = selectedDevice.platform;
    options.device = selectedDevice.id;

    let command;
    switch (platform) {
      case 'android':
        command = new AndroidRunCommand(platform, options);
        break;
      case 'ios':
        command = new IOSRunCommand(platform, options);
        break;
    }

    await command.execute();

  } catch (error) {
    spinner.fail('Run failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
