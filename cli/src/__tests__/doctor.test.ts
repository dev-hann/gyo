import { DoctorCommand } from '../commands/doctor';

class TestableDoctorCommand extends DoctorCommand {
  public async testRun(): Promise<void> {
    return this.run();
  }
}

jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
}));

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  copyDir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  removeDir: jest.fn(),
  getTemplatesPath: jest.fn(),
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

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
}));

import { executeCommand, checkCommandExists } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { logger } from '../utils/logger';
import * as fs from 'fs';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedReaddirSync = fs.readdirSync as jest.Mock;

function execResult(overrides: Partial<{ success: boolean; stdout: string; stderr: string }> = {}) {
  return { success: true, stdout: '', stderr: '', code: 0, ...overrides };
}

describe('DoctorCommand', () => {
  let command: TestableDoctorCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableDoctorCommand();
  });

  describe('run', () => {
    it('should pass when all core tools are installed', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'node') return Promise.resolve(execResult({ stdout: 'v20.0.0' }));
        if (cmd === 'npm') return Promise.resolve(execResult({ stdout: '10.0.0' }));
        if (cmd === 'git') return Promise.resolve(execResult({ stdout: 'git version 2.40' }));
        if (cmd === 'java') return Promise.resolve(execResult({ stderr: 'openjdk 17.0.18' }));
        if (cmd === 'adb')
          return Promise.resolve(execResult({ stdout: 'Android Debug Bridge version 34.0.5' }));
        if (cmd === 'gradle') return Promise.resolve(execResult({ stdout: 'Gradle 8.5' }));
        if (cmd === 'xtool') return Promise.resolve(execResult({ stdout: 'xtool 1.0.0' }));
        if (cmd === 'swift' && args && args[0] === 'sdk')
          return Promise.resolve(execResult({ stdout: 'darwin\n' }));
        if (cmd === 'swift') return Promise.resolve(execResult({ stdout: 'Swift version 5.9' }));
        if (cmd === 'which') return Promise.resolve(execResult({ stdout: '/usr/bin/java' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });
      mockedPathExists.mockResolvedValue(true);
      mockedReaddirSync
        .mockReturnValueOnce(['android-34', 'android-35'])
        .mockReturnValueOnce(['34.0.0', '35.0.0'])
        .mockReturnValueOnce(['android-sdk-license']);

      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/home/test/Android/Sdk';
      await command.testRun();
      process.env.ANDROID_HOME = originalHome;

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Ready to build and run')
      );
    });

    it('should fail when node is not installed', async () => {
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No platforms are ready'));
    });

    it('should warn when node version is below minimum', async () => {
      mockedCheck.mockImplementation(async (cmd: string) => {
        return cmd === 'node';
      });
      mockedExec.mockImplementation((cmd: string) => {
        if (cmd === 'node') return Promise.resolve(execResult({ stdout: 'v16.0.0' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('v16.0.0'));
    });

    it('should detect ANDROID_HOME env variable', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/opt/android-sdk';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(true);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('/opt/android-sdk'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it('should warn when ANDROID_HOME path does not exist', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/nonexistent/sdk';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it('should use ANDROID_SDK_ROOT as fallback', async () => {
      const originalHome = process.env.ANDROID_HOME;
      const originalRoot = process.env.ANDROID_SDK_ROOT;
      delete process.env.ANDROID_HOME;
      process.env.ANDROID_SDK_ROOT = '/opt/android-sdk-root';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(true);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('/opt/android-sdk-root'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
      if (originalRoot) {
        process.env.ANDROID_SDK_ROOT = originalRoot;
      } else {
        delete process.env.ANDROID_SDK_ROOT;
      }
    });

    it('should detect installed Android platforms', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/opt/android-sdk';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(true);
      mockedReaddirSync
        .mockReturnValueOnce(['android-34', 'android-35'])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('API'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it('should detect installed Android build-tools', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/opt/android-sdk';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(true);
      mockedReaddirSync
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['34.0.0', '35.0.0'])
        .mockReturnValueOnce([]);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('34.0.0'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it('should check JDK version', async () => {
      mockedCheck.mockImplementation(async (cmd: string) => {
        return cmd === 'java' || cmd === 'node';
      });
      mockedExec.mockImplementation((cmd: string) => {
        if (cmd === 'node') return Promise.resolve(execResult({ stdout: 'v20.0.0' }));
        if (cmd === 'npm') return Promise.resolve(execResult({ stdout: '10.0.0' }));
        if (cmd === 'java')
          return Promise.resolve(execResult({ stderr: 'openjdk 17.0.18 2024-01-01' }));
        if (cmd === 'which') return Promise.resolve(execResult({ stdout: '/usr/bin/java' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('17.0.18'));
    });

    it('should report xtool as optional iOS dependency', async () => {
      mockedCheck.mockImplementation(async (cmd: string) => {
        return (
          cmd !== 'xtool' &&
          cmd !== 'swift' &&
          cmd !== 'idevice_id' &&
          cmd !== 'idevicesyslog' &&
          cmd !== 'ideviceinfo'
        );
      });
      mockedExec.mockImplementation((cmd: string) => {
        if (cmd === 'node') return Promise.resolve(execResult({ stdout: 'v20.0.0' }));
        if (cmd === 'npm') return Promise.resolve(execResult({ stdout: '10.0.0' }));
        if (cmd === 'git') return Promise.resolve(execResult({ stdout: 'git version 2.40' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('xtool'));
    });

    it('should show install hints for missing tools', async () => {
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Fix missing dependencies'));
    });

    it('should show platform readiness summary', async () => {
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Platform Readiness'));
    });

    it('should detect Darwin SDK when installed', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'swift' && args && args[0] === 'sdk')
          return Promise.resolve(execResult({ stdout: 'darwin\n' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Darwin SDK'));
    });

    it('should warn when Darwin SDK is not installed', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'swift' && args && args[0] === 'sdk')
          return Promise.resolve(
            execResult({ stdout: 'No Swift SDKs are currently installed.\n' })
          );
        return Promise.resolve(execResult({ stdout: '' }));
      });

      await command.testRun();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Darwin SDK'));
    });

    it('should detect accepted Android SDK licenses', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/opt/android-sdk';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(true);
      mockedReaddirSync
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['android-sdk-license', 'android-sdk-arm-dbt-license']);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Accepted'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it('should warn when Android SDK licenses not accepted', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/opt/android-sdk';
      mockedCheck.mockResolvedValue(false);
      mockedPathExists.mockResolvedValue(true);
      mockedReaddirSync.mockReturnValueOnce([]).mockReturnValueOnce([]).mockReturnValueOnce([]);

      await command.testRun();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('licenses not accepted'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it('should require Darwin SDK for iOS readiness even when xtool is installed', async () => {
      mockedCheck.mockImplementation(async (cmd: string) => {
        return cmd === 'xtool' || cmd === 'swift';
      });
      mockedExec.mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === 'xtool') return Promise.resolve(execResult({ stdout: 'xtool 1.0.0' }));
        if (cmd === 'swift' && args && args[0] === 'sdk')
          return Promise.resolve(
            execResult({ stdout: 'No Swift SDKs are currently installed.\n' })
          );
        if (cmd === 'swift') return Promise.resolve(execResult({ stdout: 'Swift version 5.9' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });
      mockedPathExists.mockResolvedValue(false);

      await command.testRun();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('iOS'));
    });
  });
});
