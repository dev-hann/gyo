import { executeCommand, checkCommandExists } from '../utils/exec';
import { logger } from '../utils/logger';

export interface Device {
  platform: 'android' | 'ios';
  id: string;
  name: string;
  state: string;
}

export async function getAndroidDevices(): Promise<Device[]> {
  const devices: Device[] = [];

  if (!(await checkCommandExists('adb'))) {
    logger.debug('ADB not found, skipping Android device detection');
    return devices;
  }

  try {
    const result = await executeCommand('adb', ['devices', '-l'], { stdio: 'pipe' });

    if (!result.success) {
      logger.debug('Failed to get Android devices');
      return devices;
    }

    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (!line.trim() || line.includes('List of devices')) {
        continue;
      }

      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      const deviceId = parts[0];
      const state = parts[1];

      if (state !== 'device') {
        continue;
      }

      let model = deviceId;
      const modelMatch = line.match(/model:([^\s]+)/);
      if (modelMatch) {
        model = modelMatch[1].replace(/_/g, ' ');
      }

      devices.push({
        platform: 'android',
        id: deviceId,
        name: model,
        state: 'Available',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`Error detecting Android devices: ${message}`);
  }

  return devices;
}

export async function getIOSDevices(): Promise<Device[]> {
  const devices: Device[] = [];

  if (!(await checkCommandExists('idevice_id'))) {
    logger.debug('idevice_id not found, skipping iOS device detection');
    return devices;
  }

  const hasIdeviceInfo = await checkCommandExists('ideviceinfo');

  try {
    const deviceResult = await executeCommand('idevice_id', ['-l'], { stdio: 'pipe' });

    if (deviceResult.success && deviceResult.stdout) {
      const deviceIds = deviceResult.stdout
        .trim()
        .split('\n')
        .filter((id) => id.trim());

      if (deviceIds.length === 0) {
        logger.debug('No iOS devices connected');
        return devices;
      }

      for (const deviceId of deviceIds) {
        let deviceName = 'iOS Device';
        let deviceModel = '';

        if (hasIdeviceInfo) {
          const nameResult = await executeCommand(
            'ideviceinfo',
            ['-u', deviceId, '-k', 'DeviceName'],
            { stdio: 'pipe' }
          );
          if (nameResult.success && nameResult.stdout) {
            deviceName = nameResult.stdout.trim() || deviceName;
          }

          const modelResult = await executeCommand(
            'ideviceinfo',
            ['-u', deviceId, '-k', 'ProductType'],
            { stdio: 'pipe' }
          );
          if (modelResult.success && modelResult.stdout) {
            deviceModel = modelResult.stdout.trim();
            if (deviceModel) {
              deviceName = `${deviceName} (${deviceModel})`;
            }
          }
        }

        devices.push({
          platform: 'ios',
          id: deviceId,
          name: deviceName,
          state: 'Available',
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`Error detecting iOS devices: ${message}`);
  }

  return devices;
}

export async function getAllDevices(): Promise<Device[]> {
  const [androidDevices, iosDevices] = await Promise.all([getAndroidDevices(), getIOSDevices()]);

  return [...androidDevices, ...iosDevices];
}
