import { RunCommand } from '../commands/run';
import { Device } from '../services/device.service';

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
  getTemplatesPath: jest.fn(),
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

  describe('createCommand', () => {
    it('should create AndroidRunCommand for android device', () => {
      const result = command['createCommand'](androidDevice);
      expect(result.constructor.name).toBe('AndroidRunCommand');
    });

    it('should create IOSRunCommand for ios device', () => {
      const result = command['createCommand'](iosDevice);
      expect(result.constructor.name).toBe('IOSRunCommand');
    });

    it('should throw InvalidPlatformError for unknown platform', () => {
      const unknownDevice = {
        platform: 'windows',
        id: 'x',
        name: 'test',
        state: 'Available',
      } as unknown as Device;

      expect(() => command['createCommand'](unknownDevice)).toThrow();
    });
  });
});
