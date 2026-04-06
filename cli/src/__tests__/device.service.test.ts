import { getAndroidDevices, getIOSDevices, getAllDevices } from '../services/device.service';

jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setVerbose: jest.fn(),
    isVerbose: jest.fn().mockReturnValue(false),
  },
}));

import { executeCommand, checkCommandExists } from '../utils/exec';
import { logger } from '../utils/logger';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;

function mockExecResult(
  overrides: Partial<{ success: boolean; stdout: string; stderr: string; code: number | null }> = {}
) {
  return {
    success: true,
    stdout: '',
    stderr: '',
    code: 0,
    ...overrides,
  };
}

describe('device.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAndroidDevices', () => {
    it('should return empty array when adb is not installed', async () => {
      mockedCheck.mockResolvedValue(false);

      const devices = await getAndroidDevices();

      expect(devices).toEqual([]);
      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should return empty array when adb command fails', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(mockExecResult({ success: false }));

      const devices = await getAndroidDevices();

      expect(devices).toEqual([]);
    });

    it('should parse connected android devices', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(
        mockExecResult({
          stdout:
            'List of devices attached\n' +
            'emulator-5554   device usb:1-1 product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64x\n' +
            'ABCD1234        device usb:1-2 product:a70 model:SM-A705 model:Samsung_Galaxy_A70\n',
        })
      );

      const devices = await getAndroidDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        platform: 'android',
        id: 'emulator-5554',
        name: 'sdk gphone64 x86 64',
        state: 'device',
      });
      expect(devices[1].id).toBe('ABCD1234');
    });

    it('should skip devices that are not in device state', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(
        mockExecResult({
          stdout: 'List of devices attached\nemulator-5554   unauthorized\n',
        })
      );

      const devices = await getAndroidDevices();

      expect(devices).toEqual([]);
    });

    it('should skip blank lines and header line', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(
        mockExecResult({
          stdout: 'List of devices attached\n\nemulator-5554   device\n\n',
        })
      );

      const devices = await getAndroidDevices();

      expect(devices).toHaveLength(1);
    });

    it('should use deviceId as name when model not found', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(
        mockExecResult({
          stdout: 'emulator-5554   device\n',
        })
      );

      const devices = await getAndroidDevices();

      expect(devices[0].name).toBe('emulator-5554');
    });

    it('should return empty on exception', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockRejectedValue(new Error('spawn error'));

      const devices = await getAndroidDevices();

      expect(devices).toEqual([]);
    });

    it('should log debug when adb not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await getAndroidDevices();

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('ADB not found'));
    });

    it('should log debug when adb command fails', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockResolvedValue(mockExecResult({ success: false }));

      await getAndroidDevices();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get Android devices')
      );
    });

    it('should log debug on exception', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockRejectedValue(new Error('spawn error'));

      await getAndroidDevices();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Error detecting Android devices')
      );
    });
  });

  describe('getIOSDevices', () => {
    it('should return empty array when idevice_id is not installed', async () => {
      mockedCheck.mockResolvedValue(false);

      const devices = await getIOSDevices();

      expect(devices).toEqual([]);
    });

    it('should parse connected iOS devices with name and model', async () => {
      mockedCheck.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
      mockedExec
        .mockResolvedValueOnce(mockExecResult({ stdout: 'abc123\ndef456\n' }))
        .mockResolvedValueOnce(mockExecResult({ stdout: 'iPhone\n' }))
        .mockResolvedValueOnce(mockExecResult({ stdout: 'iPhone12,1\n' }))
        .mockResolvedValueOnce(mockExecResult({ stdout: 'iPad\n' }))
        .mockResolvedValueOnce(mockExecResult({ stdout: '' }));

      const devices = await getIOSDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        platform: 'ios',
        id: 'abc123',
        name: 'iPhone (iPhone12,1)',
        state: 'Available',
      });
      expect(devices[1]).toEqual({
        platform: 'ios',
        id: 'def456',
        name: 'iPad',
        state: 'Available',
      });
    });

    it('should return empty array when no devices connected', async () => {
      mockedCheck.mockResolvedValueOnce(true);
      mockedExec.mockResolvedValueOnce(mockExecResult({ stdout: '' }));

      const devices = await getIOSDevices();

      expect(devices).toEqual([]);
    });

    it('should use default name when ideviceinfo is not available', async () => {
      mockedCheck.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      mockedExec.mockResolvedValueOnce(mockExecResult({ stdout: 'abc123\n' }));

      const devices = await getIOSDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('iOS Device');
    });

    it('should return empty on exception', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockRejectedValue(new Error('spawn error'));

      const devices = await getIOSDevices();

      expect(devices).toEqual([]);
    });

    it('should log debug when idevice_id not found', async () => {
      mockedCheck.mockResolvedValue(false);

      await getIOSDevices();

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('idevice_id not found'));
    });

    it('should log debug on exception', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockRejectedValue(new Error('spawn error'));

      await getIOSDevices();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Error detecting iOS devices')
      );
    });
  });

  describe('getAllDevices', () => {
    it('should combine android and ios devices', async () => {
      mockedCheck
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockedExec.mockResolvedValueOnce(
        mockExecResult({
          stdout: 'emulator-5554   device\n',
        })
      );

      const devices = await getAllDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0].platform).toBe('android');
    });

    it('should return empty when no devices of any platform', async () => {
      mockedCheck.mockResolvedValue(false);

      const devices = await getAllDevices();

      expect(devices).toEqual([]);
    });
  });
});
