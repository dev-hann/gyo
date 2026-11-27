// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));
// ESM-only
jest.mock('inquirer', () => ({ prompt: jest.fn(), default: { prompt: jest.fn() } }));
jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// Only what starts a process or asks for a tool is mocked: the build runs
// against a real project, and the mocked xtool reads what it packs from disk.
jest.mock('../utils/exec', () => ({
  ...jest.requireActual('../utils/exec'),
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
}));

import fs from 'fs-extra';
import { IOSBuildCommand } from '../commands/build/IOSBuildCommand';
import { BuildFailedError, ToolRequiredError } from '../core/errors';
import { checkCommandExists, executeCommand, requireTool } from '../utils/exec';
import type { ExecResult } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

const PRODUCTION_URL = 'https://app.example.com';
const CONFIG_FILE = 'Sources/Resources/gyo-config.json';
const DEVICE_LISTED: ExecResult = {
  success: true,
  stdout: '00008030-000A1B2C3D4E5F60',
  stderr: '',
  code: 0,
};
const BUILD_SUCCEEDED: ExecResult = {
  success: true,
  stdout: 'Build Succeeded',
  stderr: '',
  code: 0,
};

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheckCommandExists = checkCommandExists as jest.MockedFunction<
  typeof checkCommandExists
>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;

describe('IOSBuildCommand', () => {
  let project: TestProject;

  /** Runs `gyo build ios` with the production profile, as `gyo build` does. */
  function build(release = false): Promise<void> {
    const command = new IOSBuildCommand();
    command.setOptions({ profile: 'production', release });
    return command.runDirectly();
  }

  /** The commands the CLI ran, in order. */
  const commandsRun = (): string[] => mockedExec.mock.calls.map(([command]) => command);

  /**
   * Makes each command answer with what is given for it, as the real one
   * would print. A command that is not listed ends the build.
   */
  function answers(byCommand: Record<string, ExecResult>): void {
    mockedExec.mockImplementation((command) => {
      const output = byCommand[command];
      if (!output) {
        throw new Error(`The build ran ${command}, which this test does not answer.`);
      }
      return Promise.resolve(output);
    });
  }

  beforeEach(async () => {
    silenceLogger();
    project = await createTestProject();
    jest.clearAllMocks();
    await project.setConfig({ profiles: { production: { serverUrl: PRODUCTION_URL } } });

    // xtool is installed and a device is connected: what a build needs to go through.
    mockedRequireTool.mockResolvedValue(undefined);
    mockedCheckCommandExists.mockResolvedValue(true);
    answers({ idevice_id: DEVICE_LISTED, xtool: BUILD_SUCCEEDED });
  });

  afterEach(() => project.remove());

  it('should refuse --release before the web app is built or the profile is asked for', async () => {
    project.setWebApp({ build: 'vite build' });
    await project.setConfig({ profiles: {} });

    await expect(build(true)).rejects.toThrow('--release is not supported for iOS');

    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('should refuse --release before the iOS project is touched', async () => {
    await expect(build(true)).rejects.toThrow('--release is not supported for iOS');

    expect(requireTool).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
    expect(fs.pathExistsSync(project.ios(CONFIG_FILE))).toBe(false);
  });

  it('should write the server URL where the app reads it before xtool packs it', async () => {
    let packed: string | undefined;
    mockedExec.mockImplementation(async (command) => {
      if (command === 'xtool') {
        packed = fs.readFileSync(project.ios(CONFIG_FILE), 'utf-8');
      }
      return command === 'idevice_id' ? DEVICE_LISTED : BUILD_SUCCEEDED;
    });

    await build();

    expect(JSON.parse(packed ?? 'null')).toEqual({ serverUrl: PRODUCTION_URL });
  });

  describe('what a build needs', () => {
    it('should stop when the project has no ios/ directory', async () => {
      fs.removeSync(project.ios());

      await expect(build()).rejects.toThrow(`Platform 'ios' not found in ${project.path}.`);

      expect(requireTool).not.toHaveBeenCalled();
    });

    it('should stop when xtool is not installed, saying where to get it', async () => {
      mockedRequireTool.mockRejectedValue(
        new ToolRequiredError('xtool', 'Install xtool: https://xtool.sh')
      );

      await expect(build()).rejects.toThrow(ToolRequiredError);

      expect(requireTool).toHaveBeenCalledWith('xtool', 'Install xtool: https://xtool.sh');
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it('should stop when idevice_id is not installed, saying what to install', async () => {
      mockedCheckCommandExists.mockResolvedValue(false);

      await expect(build()).rejects.toThrow('idevice_id not found');

      expect(checkCommandExists).toHaveBeenCalledWith('idevice_id');
      expect(logger.error).toHaveBeenCalledWith('Install libimobiledevice or use a Mac with Xcode');
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it.each([
      {
        // It failed, though it printed a device: the exit status counts.
        outcome: 'fails',
        result: {
          success: false,
          stdout: '00008030-000A1B2C3D4E5F60',
          stderr: 'ERROR: Could not connect to lockdownd',
          code: 1,
        },
      },
      { outcome: 'lists no device', result: { success: true, stdout: '', stderr: '', code: 0 } },
    ])(
      'should stop the build when idevice_id $outcome, saying that no device is connected',
      async ({ result }) => {
        answers({ idevice_id: result });

        await expect(build()).rejects.toThrow('No iOS device connected');

        expect(commandsRun()).toEqual(['idevice_id']);
        expect(executeCommand).toHaveBeenCalledWith('idevice_id', ['-l'], { stdio: 'pipe' });
        expect(logger.error).toHaveBeenCalledWith(
          'Connect an iOS device to build. xtool requires a device for building.'
        );
      }
    );
  });

  describe('xtool dev', () => {
    it('should run xtool dev in ios/ with a device connected', async () => {
      await build();

      expect(commandsRun()).toEqual(['idevice_id', 'xtool']);
      expect(executeCommand).toHaveBeenCalledWith('xtool', ['dev'], {
        cwd: project.ios(),
        stdio: 'pipe',
      });
      expect(logger.verbose).toHaveBeenCalledWith('Build Succeeded');
    });

    it.each([
      {
        where: 'on stderr',
        result: {
          success: false,
          stdout: 'Compiling the app',
          stderr: 'Signing the app failed',
          code: 1,
        },
        shown: 'Signing the app failed',
      },
      {
        where: 'on stdout when stderr is empty',
        result: { success: false, stdout: 'No devices are paired.', stderr: '', code: 1 },
        shown: 'No devices are paired.',
      },
    ])('should fail the build and show what xtool printed $where', async ({ result, shown }) => {
      answers({ idevice_id: DEVICE_LISTED, xtool: result });

      const failing = build();
      await expect(failing).rejects.toThrow(BuildFailedError);
      await expect(failing).rejects.toThrow('iOS build failed');

      expect(logger.error).toHaveBeenCalledWith(shown);
    });

    it.each([
      { error: 'typeMismatch: Expected to decode Scalar' },
      { error: 'Error: Expected to decode Scalar value' },
    ])('should explain a YAML error in xtool.yml when xtool prints "$error"', async ({ error }) => {
      answers({
        idevice_id: DEVICE_LISTED,
        xtool: { success: false, stdout: '', stderr: error, code: 1 },
      });

      await expect(build()).rejects.toThrow('iOS build failed');

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('YAML parsing error in xtool.yml')
      );
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(error));
    });
  });
});
