import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { Platform, RunCommandOptions } from './common/AbstractPlatformCommand.js';
import { AndroidRunCommand } from './run/AndroidRunCommand.js';
import { IOSRunCommand } from './run/IOSRunCommand.js';
import { getAllDevices, Device } from '../utils/devices.js';
import { logger } from '../utils/logger.js';
import { GyoError } from '../utils/errors.js';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run the application on a connected device')
    .option('-d, --device <device>', 'Specific device ID to run on')
    .option('-p, --profile <profile>', 'Build profile to use (development, production, etc.)', 'development')
    .option('-v, --verbose', 'Show detailed logs')
    .action(async (rawOptions: { device?: string; profile: string; verbose?: boolean }) => {
      if (rawOptions.verbose) {
        logger.setVerbose(true);
      }
      await runOnDevice(rawOptions);
    });
}

async function runOnDevice(rawOptions: { device?: string; profile: string; verbose?: boolean }): Promise<void> {
  const spinner = ora('Detecting devices...').start();

  try {
    const devices = await getAllDevices();

    if (devices.length === 0) {
      spinner.fail('No devices found');
      logger.error('Please connect a device or start an emulator');
      logger.info('');
      logger.info('Troubleshooting:');
      logger.info('  - For Android: Ensure ADB is installed and a device/emulator is connected');
      logger.info('  - For iOS: Ensure libimobiledevice-utils is installed and a device is connected');
      logger.info('    Install on Linux: sudo apt install libimobiledevice-utils');
      throw new GyoError('No devices found');
    }

    let selectedDevice: Device;

    if (rawOptions.device) {
      const device = devices.find(d => d.id === rawOptions.device);
      if (!device) {
        spinner.fail(`Device '${rawOptions.device}' not found`);
        logger.error('Available devices:');
        devices.forEach(d => logger.info(`  - ${d.platform}: ${d.name} (${d.id})`));
        throw new GyoError(`Device '${rawOptions.device}' not found`);
      }
      selectedDevice = device;
      spinner.stop();
      logger.info(`Using specified device: ${selectedDevice.name} (${selectedDevice.platform})`);
    } else if (devices.length === 1) {
      selectedDevice = devices[0];
      spinner.stop();
      logger.info(`Found 1 device. Automatically selecting '${selectedDevice.name}' (${selectedDevice.platform})`);
    } else {
      spinner.stop();
      logger.log('');
      logger.success(`Found ${devices.length} devices:`);
      logger.log('');

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

    const platform: Platform = selectedDevice.platform;
    
    const options: RunCommandOptions = {
      profile: rawOptions.profile,
      device: selectedDevice.id
    };

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
    throw error;
  }
}
