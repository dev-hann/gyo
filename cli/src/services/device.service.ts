import { executeCommand, checkCommandExists } from '../utils/exec';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../core/errors';

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
        state,
      });
    }
  } catch (error) {
    const message = getErrorMessage(error);
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

    if (!deviceResult.success || !deviceResult.stdout) {
      logger.debug('Failed to get iOS devices');
      return devices;
    }

    const deviceIds = deviceResult.stdout
      .trim()
      .split('\n')
      .filter((id) => id.trim());

    if (deviceIds.length === 0) {
      logger.debug('No iOS devices connected');
      return devices;
    }

    const deviceInfoPromises = deviceIds.map(async (deviceId) => {
      let deviceName = 'iOS Device';

      if (hasIdeviceInfo) {
        try {
          const [nameResult, modelResult] = await Promise.all([
            executeCommand('ideviceinfo', ['-u', deviceId, '-k', 'DeviceName'], { stdio: 'pipe' }),
            executeCommand('ideviceinfo', ['-u', deviceId, '-k', 'ProductType'], { stdio: 'pipe' }),
          ]);
          if (nameResult.success && nameResult.stdout) {
            deviceName = nameResult.stdout.trim() || deviceName;
          }
          if (modelResult.success && modelResult.stdout) {
            const modelValue = modelResult.stdout.trim();
            if (modelValue) {
              deviceName = `${deviceName} (${modelValue})`;
            }
          }
        } catch {
          logger.debug(`Failed to get info for iOS device ${deviceId}, using default name`);
        }
      }

      return {
        platform: 'ios' as const,
        id: deviceId,
        name: deviceName,
        state: 'Available',
      };
    });

    const results = await Promise.allSettled(deviceInfoPromises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        devices.push(result.value);
      } else {
        const reasonMessage =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.debug(`Failed to get device info: ${reasonMessage}`);
      }
    }
  } catch (error) {
    const message = getErrorMessage(error);
    logger.debug(`Error detecting iOS devices: ${message}`);
  }

  return devices;
}

export async function getAllDevices(): Promise<Device[]> {
  const [androidDevices, iosDevices] = await Promise.all([getAndroidDevices(), getIOSDevices()]);

  return [...androidDevices, ...iosDevices];
}
