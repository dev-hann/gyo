import { Command } from 'commander';
import ora from 'ora';
import { logger } from '../utils/logger';
import { getAllDevices, Device } from '../utils/devices';

export function registerDevicesCommand(program: Command): void {
  program
    .command('devices')
    .description('List all available development devices (Android and iOS)')
    .option('--json', 'Output as JSON', false)
    .action(async (options: { json: boolean }) => {
      await listDevices(options);
    });
}

async function listDevices(options: { json: boolean }): Promise<void> {
  const spinner = ora('Detecting devices...').start();
  
  try {
    const devices = await getAllDevices();
    spinner.stop();

    // Output results
    if (devices.length === 0) {
      logger.warn('No available devices found');
      logger.info('');
      logger.info('Troubleshooting:');
      logger.info('  - For Android: Ensure ADB is installed and a device/emulator is connected');
      logger.info('  - For iOS: Ensure libimobiledevice-utils is installed and a device is connected');
      logger.info('    Install on Linux: sudo apt install libimobiledevice-utils');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(devices, null, 2));
    } else {
      displayDevicesTable(devices);
    }

  } catch (error) {
    spinner.fail('Failed to detect devices');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function displayDevicesTable(devices: Device[]): void {
  logger.log('');
  logger.success(`Found ${devices.length} available device(s):`);
  logger.log('');

  // Calculate column widths
  const platformWidth = Math.max(8, ...devices.map(d => d.platform.length));
  const idWidth = Math.max(12, ...devices.map(d => d.id.length));
  const nameWidth = Math.max(20, ...devices.map(d => d.name.length));
  const stateWidth = Math.max(10, ...devices.map(d => d.state.length));

  // Print header
  const header = [
    'Platform'.padEnd(platformWidth),
    'ID'.padEnd(idWidth),
    'Name/Model'.padEnd(nameWidth),
    'State'.padEnd(stateWidth)
  ].join('  ');
  
  logger.log(header);
  logger.log('-'.repeat(header.length));

  // Print devices
  for (const device of devices) {
    const row = [
      device.platform.toUpperCase().padEnd(platformWidth),
      device.id.padEnd(idWidth),
      device.name.padEnd(nameWidth),
      device.state.padEnd(stateWidth)
    ].join('  ');
    
    logger.log(row);
  }

  logger.log('');
}
