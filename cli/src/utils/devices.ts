import { executeCommand, checkCommandExists } from './exec';
import { logger } from './logger';

export interface Device {
  platform: 'android' | 'ios';
  id: string;
  name: string;
  state: string;
}

/**
 * Detects all available Android devices.
 */
export async function getAndroidDevices(): Promise<Device[]> {
  const devices: Device[] = [];

  // Check if adb is available
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

    // Parse adb output
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

      // Only include devices that are online/device state
      if (state !== 'device') {
        continue;
      }

      // Extract model from the line
      let model = deviceId;
      const modelMatch = line.match(/model:([^\s]+)/);
      if (modelMatch) {
        model = modelMatch[1].replace(/_/g, ' ');
      }

      devices.push({
        platform: 'android',
        id: deviceId,
        name: model,
        state: 'Available'
      });
    }
  } catch (error) {
    logger.debug(`Error detecting Android devices: ${error}`);
  }

  return devices;
}

/**
 * Detects all available iOS devices.
 */
export async function getIOSDevices(): Promise<Device[]> {
  const devices: Device[] = [];

  // Check if idevice_id is available (from libimobiledevice)
  if (!(await checkCommandExists('idevice_id'))) {
    logger.debug('idevice_id not found, skipping iOS device detection');
    return devices;
  }

  try {
    // Get physical devices using idevice_id
    const deviceResult = await executeCommand('idevice_id', ['-l'], { stdio: 'pipe' });
    
    if (deviceResult.success && deviceResult.stdout) {
      const deviceIds = deviceResult.stdout.trim().split('\n').filter(id => id.trim());
      
      if (deviceIds.length === 0) {
        logger.debug('No iOS devices connected');
        return devices;
      }
      
      for (const deviceId of deviceIds) {
        // Try to get device name using ideviceinfo
        let deviceName = 'iOS Device';
        let deviceModel = '';
        
        if (await checkCommandExists('ideviceinfo')) {
          // Get device name
          const nameResult = await executeCommand('ideviceinfo', ['-u', deviceId, '-k', 'DeviceName'], { stdio: 'pipe' });
          if (nameResult.success && nameResult.stdout) {
            deviceName = nameResult.stdout.trim() || deviceName;
          }
          
          // Get product type for better identification
          const modelResult = await executeCommand('ideviceinfo', ['-u', deviceId, '-k', 'ProductType'], { stdio: 'pipe' });
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
          state: 'Available'
        });
      }
    }
  } catch (error) {
    logger.debug(`Error detecting iOS devices: ${error}`);
  }

  return devices;
}

/**
 * Detects all available devices (Android and iOS).
 */
export async function getAllDevices(): Promise<Device[]> {
  const [androidDevices, iosDevices] = await Promise.all([
    getAndroidDevices(),
    getIOSDevices()
  ]);

  return [...androidDevices, ...iosDevices];
}
