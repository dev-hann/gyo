import { Command } from 'commander';
import ora from 'ora';
import { logger } from '../utils/logger.js';
import { getAllDevices, Device } from '../utils/devices.js';
import { GyoError } from '../utils/errors.js';

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

    if (devices.length === 0) {
      logger.warn('No available devices found');
      showTroubleshootingInfo();
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(devices, null, 2));
    } else {
      displayDevicesTable(devices);
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail('Failed to detect devices');
    throw new GyoError(message);
  }
}

function showTroubleshootingInfo(): void {
  logger.info('');
  logger.info('Troubleshooting:');
  logger.info('  - For Android: Ensure ADB is installed and a device/emulator is connected');
  logger.info('  - For iOS: Ensure libimobiledevice-utils is installed and a device is connected');
  logger.info('    Install on Linux: sudo apt install libimobiledevice-utils');
}

function displayDevicesTable(devices: Device[]): void {
  logger.log('');
  logger.success(`Found ${devices.length} available device(s):`);
  logger.log('');

  const columnWidths = calculateColumnWidths(devices);
  
  const header = [
    'Platform'.padEnd(columnWidths.platform),
    'ID'.padEnd(columnWidths.id),
    'Name/Model'.padEnd(columnWidths.name),
    'State'.padEnd(columnWidths.state)
  ].join('  ');
  
  logger.log(header);
  logger.log('-'.repeat(header.length));

  for (const device of devices) {
    const row = [
      device.platform.toUpperCase().padEnd(columnWidths.platform),
      device.id.padEnd(columnWidths.id),
      device.name.padEnd(columnWidths.name),
      device.state.padEnd(columnWidths.state)
    ].join('  ');
    
    logger.log(row);
  }

  logger.log('');
}

function calculateColumnWidths(devices: Device[]): {
  platform: number;
  id: number;
  name: number;
  state: number;
} {
  return {
    platform: Math.max(8, ...devices.map(d => d.platform.length)),
    id: Math.max(12, ...devices.map(d => d.id.length)),
    name: Math.max(20, ...devices.map(d => d.name.length)),
    state: Math.max(10, ...devices.map(d => d.state.length))
  };
}
