import { RunCommand } from '../commands/run';
import type { Device } from '../services/device.service';

jest.mock('../services/device.service', () => ({
  getAllDevices: jest.fn(),
  getAndroidDevices: jest.fn().mockResolvedValue([]),
  getIOSDevices: jest.fn().mockResolvedValue([]),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    setVerbose: jest.fn(),
    isVerbose: jest.fn().mockReturnValue(false),
    suggestNextSteps: jest.fn(),
  },
}));

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn().mockResolvedValue(false),
  ensureDir: jest.fn(),
  copyDir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  removeDir: jest.fn(),
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

import { logger } from '../utils/logger';
import inquirer from 'inquirer';

const mockedPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

const androidDevice: Device = {
  platform: 'android',
  id: 'emulator-5554',
  name: 'Pixel 7',
  state: 'Available',
};

const iosDevice: Device = {
  platform: 'ios',
  id: 'abc123',
  name: 'iPhone 15 Pro',
  state: 'Available',
};

describe('RunCommand', () => {
  let command: RunCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new RunCommand();
  });

  describe('showNoDevicesError', () => {
    it('should log troubleshooting info', () => {
      command['showNoDevicesError']();

      expect(logger.error).toHaveBeenCalledWith('Please connect a device or start an emulator');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Troubleshooting'));
    });
  });

  describe('selectDevice', () => {
    it('should throw when specified device not found', async () => {
      command.setOptions({ profile: 'dev', device: 'nonexistent' });

      await expect(command['selectDevice']([androidDevice])).rejects.toThrow(
        "Device 'nonexistent' not found"
      );
    });

    it('should return matching device when specified device found', async () => {
      command.setOptions({ profile: 'dev', device: 'emulator-5554' });

      const result = await command['selectDevice']([androidDevice, iosDevice]);

      expect(result).toEqual(androidDevice);
    });

    it('should auto-select single device', async () => {
      command.setOptions({ profile: 'dev' });

      const result = await command['selectDevice']([androidDevice]);

      expect(result).toEqual(androidDevice);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Automatically selecting'));
    });

    it('should prompt when multiple devices and no device specified', async () => {
      command.setOptions({ profile: 'dev' });
      mockedPrompt.mockResolvedValue({ deviceIndex: 1 });

      const result = await command['selectDevice']([androidDevice, iosDevice]);

      expect(mockedPrompt).toHaveBeenCalled();
      expect(result).toEqual(iosDevice);
    });
  });

  describe('run', () => {
    let runDirectly: jest.SpyInstance;

    afterEach(() => {
      runDirectly?.mockRestore();
    });

    it('should hand the device to the command of its platform', async () => {
      const { getAllDevices } = jest.requireMock('../services/device.service');
      const { IOSRunCommand } = jest.requireActual('../commands/run/IOSRunCommand');
      getAllDevices.mockResolvedValue([androidDevice, iosDevice]);
      runDirectly = jest.spyOn(IOSRunCommand.prototype, 'runDirectly').mockImplementation(function (
        this: InstanceType<typeof IOSRunCommand>
      ) {
        expect(this['platform']).toBe('ios');
        expect(this['options']).toMatchObject({ profile: 'development', device: iosDevice.id });
        return Promise.resolve();
      });
      command.setOptions({ profile: 'development', device: iosDevice.id });

      await command.execute();

      expect(runDirectly).toHaveBeenCalledTimes(1);
    });

    it('should stop before choosing a command when no device is connected', async () => {
      const { getAllDevices } = jest.requireMock('../services/device.service');
      getAllDevices.mockResolvedValue([]);
      command.setOptions({ profile: 'development' });

      await expect(command.execute()).rejects.toThrow('No devices found');
    });
  });
});
