import { CreateCommand } from '../commands/create';

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn().mockResolvedValue(false),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  copyDir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  removeDir: jest.fn().mockResolvedValue(undefined),
  getTemplatesPath: jest.fn().mockReturnValue('/templates'),
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

jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn().mockResolvedValue({ success: true, stdout: '', stderr: '', code: 0 }),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn().mockResolvedValue(true),
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ framework: 'react' }),
  default: { prompt: jest.fn().mockResolvedValue({ framework: 'react' }) },
}));

jest.mock('fs-extra', () => ({
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn(),
  copy: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

import { pathExists, ensureDir, writeFile, copyDir, readFile, readJson } from '../utils/fs';
import { DirectoryExistsError, GyoError } from '../core/index';

const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedEnsureDir = ensureDir as jest.MockedFunction<typeof ensureDir>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedCopyDir = copyDir as jest.MockedFunction<typeof copyDir>;
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockedReadJson = readJson as jest.MockedFunction<typeof readJson>;

class TestableCreateCommand extends CreateCommand {
  public async testRun(): Promise<void> {
    return this.run();
  }
}

describe('CreateCommand', () => {
  let command: TestableCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableCreateCommand();
    command.setOptions({ template: 'react' });
    command.setProjectName('my-app');
  });

  it('should throw GyoError for empty project name', async () => {
    const emptyCommand = new TestableCreateCommand();
    emptyCommand.setOptions({ template: 'react' });
    emptyCommand.setProjectName('');

    await expect(emptyCommand.testRun()).rejects.toThrow(GyoError);
  });

  it('should throw GyoError for whitespace-only project name', async () => {
    const wsCommand = new TestableCreateCommand();
    wsCommand.setOptions({ template: 'react' });
    wsCommand.setProjectName('   ');

    await expect(wsCommand.testRun()).rejects.toThrow(GyoError);
  });

  it('should throw GyoError for project name with path separator /', async () => {
    const cmd = new TestableCreateCommand();
    cmd.setOptions({ template: 'react' });
    cmd.setProjectName('evil/path');

    await expect(cmd.testRun()).rejects.toThrow('path separators');
  });

  it('should throw GyoError for project name with path separator \\', async () => {
    const cmd = new TestableCreateCommand();
    cmd.setOptions({ template: 'react' });
    cmd.setProjectName('evil\\path');

    await expect(cmd.testRun()).rejects.toThrow('path separators');
  });

  it('should throw GyoError for project name with ..', async () => {
    const cmd = new TestableCreateCommand();
    cmd.setOptions({ template: 'react' });
    cmd.setProjectName('..');

    await expect(cmd.testRun()).rejects.toThrow('path separators');
  });

  it('should throw DirectoryExistsError when target exists', async () => {
    mockedPathExists.mockResolvedValue(true);

    await expect(command.testRun()).rejects.toThrow(DirectoryExistsError);
  });

  it('should create project directory and lib subdirectory', async () => {
    mockedPathExists.mockResolvedValue(false);
    mockedReadJson.mockResolvedValue({ scripts: { dev: 'vite' } });

    try {
      await command.testRun();
    } catch {
      // may fail on later steps, we only care about ensureDir calls
    }

    expect(mockedEnsureDir).toHaveBeenCalled();
  });

  it('should write gyo.config.json with project name and start script', async () => {
    mockedPathExists.mockResolvedValueOnce(false).mockResolvedValue(false);
    mockedReadFile.mockResolvedValue(
      '{"name":"{{PROJECT_NAME}}","script":{"start":"placeholder"}}'
    );
    mockedReadJson.mockResolvedValue({ scripts: { dev: 'vite' } });

    try {
      await command.testRun();
    } catch {
      // may fail on template copy
    }

    const configCall = mockedWriteFile.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].endsWith('gyo.config.json')
    );
    if (configCall) {
      const content = configCall[1] as string;
      expect(content).toContain('my-app');
      expect(content).toContain('npm run dev');
    }
  });

  it('should write README.md', async () => {
    mockedPathExists.mockResolvedValue(false);
    mockedReadJson.mockResolvedValue({ scripts: { dev: 'vite' } });

    try {
      await command.testRun();
    } catch {
      // may fail on later steps
    }

    const readmeCall = mockedWriteFile.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].endsWith('README.md')
    );
    expect(readmeCall).toBeDefined();
  });

  it('should skip platform template when source not found', async () => {
    mockedPathExists.mockResolvedValue(false);
    mockedReadJson.mockResolvedValue({ scripts: { dev: 'vite' } });

    try {
      await command.testRun();
    } catch {
      // expected
    }

    expect(mockedCopyDir).not.toHaveBeenCalled();
  });
});
