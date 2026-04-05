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

import { executeCommand, checkCommandExists } from '../utils/exec';
import { logger } from '../utils/logger';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;

function execResult(overrides: Partial<{ success: boolean; stdout: string }> = {}) {
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
      mockedExec.mockImplementation((cmd: string) => {
        if (cmd === 'node') return Promise.resolve(execResult({ stdout: 'v20.0.0' }));
        if (cmd === 'npm') return Promise.resolve(execResult({ stdout: '10.0.0' }));
        if (cmd === 'git') return Promise.resolve(execResult({ stdout: 'git version 2.40' }));
        if (cmd === 'swift') return Promise.resolve(execResult({ stdout: 'Swift version 5.9' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Your environment is ready')
      );
    });

    it('should fail when node is not installed', async () => {
      mockedCheck.mockResolvedValue(false);

      await command.testRun();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Some checks failed'));
    });

    it('should warn when node version is below minimum', async () => {
      mockedCheck.mockResolvedValue(true);
      mockedExec.mockImplementation((cmd: string) => {
        if (cmd === 'node') return Promise.resolve(execResult({ stdout: 'v16.0.0' }));
        if (cmd === 'npm') return Promise.resolve(execResult({ stdout: '10.0.0' }));
        if (cmd === 'git') return Promise.resolve(execResult({ stdout: 'git version 2.40' }));
        return Promise.resolve(execResult({ stdout: '' }));
      });

      await command.testRun();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Some checks failed'));
    });

    it('should detect ANDROID_HOME env variable', async () => {
      const originalHome = process.env.ANDROID_HOME;
      process.env.ANDROID_HOME = '/opt/android-sdk';
      mockedCheck.mockResolvedValue(false);

      await command.testRun();

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('/opt/android-sdk'));

      if (originalHome) {
        process.env.ANDROID_HOME = originalHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });
  });
});
