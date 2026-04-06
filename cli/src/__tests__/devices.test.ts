import { DevicesCommand } from '../commands/devices';
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

import { getAllDevices } from '../services/device.service';
import { logger } from '../utils/logger';

const mockedGetAllDevices = getAllDevices as jest.MockedFunction<typeof getAllDevices>;

class TestableDevicesCommand extends DevicesCommand {
  protected run(): Promise<void> {
    return super.run();
  }
}

const sampleDevices: Device[] = [
  { platform: 'android', id: 'emulator-5554', name: 'Pixel 7', state: 'Available' },
  { platform: 'ios', id: 'abc123', name: 'iPhone 15 Pro', state: 'Available' },
];

describe('DevicesCommand', () => {
  let command: TestableDevicesCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableDevicesCommand();
  });

  it('should warn when no devices found', async () => {
    mockedGetAllDevices.mockResolvedValue([]);

    await command['run']();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No available devices'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Troubleshooting'));
  });

  it('should display table with devices', async () => {
    mockedGetAllDevices.mockResolvedValue(sampleDevices);

    await command['run']();

    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('2 available device'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ANDROID'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('IOS'));
  });

  it('should output JSON when --json flag is set', async () => {
    mockedGetAllDevices.mockResolvedValue(sampleDevices);
    command.setOptions({ json: true });

    await command['run']();

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('emulator-5554'));
  });

  it('should throw GyoError when getAllDevices rejects', async () => {
    mockedGetAllDevices.mockRejectedValue(new Error('ADB crashed'));

    await expect(command['run']()).rejects.toThrow('ADB crashed');
  });

  it('should throw GyoError with ADB permission message on EACCES', async () => {
    const eaccErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    mockedGetAllDevices.mockRejectedValue(eaccErr);

    await expect(command['run']()).rejects.toThrow('ADB permission denied');
  });

  it('should throw GyoError with adb not found message on ENOENT', async () => {
    const enoentErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockedGetAllDevices.mockRejectedValue(enoentErr);

    await expect(command['run']()).rejects.toThrow('adb not found');
  });

  it('should throw GyoError with original message on unknown error code', async () => {
    const unknownErr = Object.assign(new Error('some failure'), { code: 'EPERM' });
    mockedGetAllDevices.mockRejectedValue(unknownErr);

    await expect(command['run']()).rejects.toThrow('some failure');
  });

  it('should handle calculateColumnWidths for long names', async () => {
    const longNameDevice: Device = {
      platform: 'android',
      id: 'device-1',
      name: 'A'.repeat(50),
      state: 'Available',
    };
    mockedGetAllDevices.mockResolvedValue([longNameDevice]);

    await command['run']();

    expect(logger.success).toHaveBeenCalled();
  });
});
