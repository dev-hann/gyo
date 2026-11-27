// Every device tool leaves the process: `adb`, `idevice_id`, `ideviceinfo`
// and the `which` that looks for them. Only that boundary is mocked, so the
// real device service parses what the tools print.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
}));

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

import { DevicesCommand } from '../commands/devices';
import type { Device } from '../services/device.service';
import { executeCommand, checkCommandExists } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';

const mockedExec = jest.mocked(executeCommand);
const mockedCheck = jest.mocked(checkCommandExists);

/**
 * What the machine answers: `installed` is what `which` finds, and the
 * command that joins its words to a key of `output` prints that output.
 */
function tools(installed: string[], output: Record<string, string>): void {
  mockedCheck.mockImplementation(async (tool) => installed.includes(tool));
  mockedExec.mockImplementation(async (command, args = []) => {
    const stdout = output[[command, ...args].join(' ')];
    return { success: stdout !== undefined, stdout: stdout ?? '', stderr: '', code: 0 };
  });
}

const PIXEL_7: Device = {
  platform: 'android',
  id: 'emulator-5554',
  name: 'Pixel 7',
  state: 'device',
};
const IPHONE: Device = {
  platform: 'ios',
  id: 'abc123',
  name: 'iPhone 15 Pro (iPhone16,1)',
  state: 'Available',
};

/**
 * What the tools print for an Android device that is ready, one that is not
 * authorized, and an iOS device.
 */
const ONE_OF_EACH: Record<string, string> = {
  'adb devices -l':
    'List of devices attached\n' +
    'emulator-5554   device usb:1-1 product:sdk_gphone64_x86_64 model:Pixel_7 device:emu64x\n' +
    'emulator-5556   unauthorized usb:1-2\n',
  'idevice_id -l': 'abc123\n',
  'ideviceinfo -u abc123 -k DeviceName': 'iPhone 15 Pro\n',
  'ideviceinfo -u abc123 -k ProductType': 'iPhone16,1\n',
};

const EVERY_TOOL = ['adb', 'idevice_id', 'ideviceinfo'];

/** `gyo devices` with its options, as Commander hands them over. */
function devices(options: { json?: boolean } = {}): Promise<void> {
  const command = new DevicesCommand();
  command.setOptions(options);
  return command.execute();
}

describe('DevicesCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with devices connected', () => {
    it('should list the devices of every platform as a table', async () => {
      tools(EVERY_TOOL, ONE_OF_EACH);

      await devices();

      expect(logger.success).toHaveBeenCalledWith('Found 2 available device(s):');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^Platform\s+ID\s+Name\/Model\s+State\s*$/)
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^ANDROID\s+emulator-5554\s+Pixel 7\s+device\s*$/)
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^IOS\s+abc123\s+iPhone 15 Pro \(iPhone16,1\)\s+Available\s*$/)
      );
    });

    it('should keep the table aligned under a name longer than its header', async () => {
      const longName = 'A'.repeat(50);
      tools(['adb'], {
        'adb devices -l': `List of devices attached\nemulator-5556   device model:${longName}\n`,
      });

      await devices();

      const lines = jest.mocked(logger.log).mock.calls.map(([line]) => line);
      const header = lines.filter((line) => line.startsWith('Platform'))[0];
      const row = lines.filter((line) => line.startsWith('ANDROID'))[0];
      expect(row).toContain(longName);
      expect(row.indexOf('device')).toBe(header.indexOf('State'));
    });
  });

  describe('gyo devices --json', () => {
    it('should print the devices as JSON, and nothing else', async () => {
      tools(EVERY_TOOL, ONE_OF_EACH);

      await devices({ json: true });

      expect(jest.mocked(logger.log)).toHaveBeenCalledTimes(1);
      expect(JSON.parse(jest.mocked(logger.log).mock.calls[0][0])).toEqual([PIXEL_7, IPHONE]);
      expect(logger.success).not.toHaveBeenCalled();
    });
  });

  describe('without a device', () => {
    it('should say so, and what to check for each platform', async () => {
      tools(['adb'], { 'adb devices -l': 'List of devices attached\n' });

      await devices();

      expect(logger.warn).toHaveBeenCalledWith('No available devices found');
      expect(logger.info).toHaveBeenCalledWith('Troubleshooting:');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Android'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('iOS'));
      expect(logger.log).not.toHaveBeenCalled();
    });
  });

  describe('when a device tool cannot even be looked for', () => {
    // The service lets nothing through of what `adb` and `idevice_id` fail
    // with; only a lookup that itself fails reaches the command.
    it.each([
      {
        code: 'EACCES',
        failure: 'spawn adb EACCES',
        reported: 'ADB permission denied. Run with sudo or check USB debugging.',
      },
      {
        code: 'ENOENT',
        failure: 'spawn adb ENOENT',
        reported: 'adb not found. Install Android SDK.',
      },
      { code: 'EPERM', failure: 'some failure', reported: 'some failure' },
      { code: undefined, failure: 'ADB crashed', reported: 'ADB crashed' },
    ])('should report $failure as "$reported"', async ({ code, failure, reported }) => {
      mockedCheck.mockRejectedValue(Object.assign(new Error(failure), code && { code }));

      await expect(devices()).rejects.toThrow(reported);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
