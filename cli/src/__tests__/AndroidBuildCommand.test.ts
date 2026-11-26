jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  default: { prompt: jest.fn() },
}));

jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    verbose: jest.fn(),
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
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  removeDir: jest.fn(),
  getTemplatesPath: jest.fn(),
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue(null),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  shouldStartLocalServer: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/android-shell.service', () => ({
  ...jest.requireActual('../services/android-shell.service'),
  syncAndroidAppIdentity: jest.fn().mockResolvedValue(undefined),
  prepareReleaseSigning: jest.fn().mockResolvedValue(undefined),
}));

import { AndroidBuildCommand } from '../commands/build/AndroidBuildCommand';
import { executeCommand } from '../utils/exec';
import { pathExists, writeFile } from '../utils/fs';
import { BuildFailedError } from '../core/errors';
import { logger } from '../utils/logger';
import { prepareReleaseSigning, syncAndroidAppIdentity } from '../services/android-shell.service';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedSyncIdentity = syncAndroidAppIdentity as jest.MockedFunction<
  typeof syncAndroidAppIdentity
>;
const mockedPrepareSigning = prepareReleaseSigning as jest.MockedFunction<
  typeof prepareReleaseSigning
>;

function makeExecResult(success: boolean, stdout = '', stderr = '') {
  return Promise.resolve({ success, stdout, stderr, code: success ? 0 : 1 });
}

describe('AndroidBuildCommand', () => {
  let command: AndroidBuildCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new AndroidBuildCommand();
    (command as any).options = { profile: 'development', release: false };
    (command as any).projectPath = '/project';
    (command as any).config = {
      name: 'test',
      version: '1.0.0',
      platforms: {},
      profiles: { development: { serverUrl: 'http://localhost:3000' } },
    };
  });

  describe('getMeta', () => {
    it('should return build-android as name', () => {
      const meta = command.getMeta();
      expect(meta.name).toBe('build-android');
    });
  });

  describe('buildApp', () => {
    it('should run assembleDebug for debug builds', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await expect(command['buildApp']('/project/android')).resolves.toBeUndefined();
      expect(mockedExec).toHaveBeenCalledWith(
        './gradlew',
        ['assembleDebug'],
        expect.objectContaining({ cwd: '/project/android' })
      );
    });

    it('should run assembleRelease for release builds', async () => {
      (command as any).options = { profile: 'production', release: true };
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await expect(command['buildApp']('/project/android')).resolves.toBeUndefined();
      expect(mockedExec).toHaveBeenCalledWith(
        './gradlew',
        ['assembleRelease'],
        expect.objectContaining({ cwd: '/project/android' })
      );
    });

    it('should log debug APK path on success', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await command['buildApp']('/project/android');

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('app-debug.apk'));
    });

    it('should log release APK path on release success', async () => {
      (command as any).options = { profile: 'production', release: true };
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await command['buildApp']('/project/android');

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('app-release.apk'));
    });

    it('should throw BuildFailedError on build failure', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'build error'));

      await expect(command['buildApp']('/project/android')).rejects.toThrow(BuildFailedError);
      await expect(command['buildApp']('/project/android')).rejects.toThrow('Android build failed');
    });

    it('should log stderr when build fails with stderr', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, '', 'gradle failure'));

      await expect(command['buildApp']('/project/android')).rejects.toThrow(BuildFailedError);
      expect(logger.error).toHaveBeenCalledWith('gradle failure');
    });

    it('should log stdout when build fails with no stderr', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(false, 'some stdout output', ''));

      await expect(command['buildApp']('/project/android')).rejects.toThrow(BuildFailedError);
      expect(logger.error).toHaveBeenCalledWith('some stdout output');
    });

    it('should log verbose output on success', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true, 'detailed output', ''));

      await command['buildApp']('/project/android');

      expect(logger.verbose).toHaveBeenCalledWith('detailed output');
    });
  });

  describe('buildPlatform (integration)', () => {
    it('should run full build pipeline successfully', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await expect(command['buildPlatform']()).resolves.toBeUndefined();

      expect(mockedWriteFile).toHaveBeenCalled();
      expect(mockedExec).toHaveBeenCalled();
    });

    it('should fail when platform directory missing', async () => {
      mockedPathExists.mockResolvedValue(false);

      await expect(command['buildPlatform']()).rejects.toThrow();
    });

    it('should bake the webview settings next to the server URL', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));
      (command as any).serverUrl = 'http://localhost:3000';
      (command as any).config.webview = { userAgent: 'MyApp/1.0' };

      await command['buildPlatform']();

      const configCall = mockedWriteFile.mock.calls.find((call) =>
        String(call[0]).endsWith('gyo-config.json')
      );
      expect(configCall).toBeDefined();
      expect(JSON.parse(configCall![1] as string)).toEqual({
        serverUrl: 'http://localhost:3000',
        webview: { userAgent: 'MyApp/1.0' },
      });
    });

    it('should sync the app identity from gyo.config.json before building', async () => {
      mockedPathExists.mockResolvedValue(true);
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));
      (command as any).serverUrl = 'http://localhost:3000';
      (command as any).config = {
        name: 'test',
        version: '3.15.0',
        displayName: '킥뉴스',
        platforms: { android: { enabled: true, versionCode: 73 } },
      };

      await command['buildPlatform']();

      expect(mockedExec).toHaveBeenCalled();
      expect(mockedSyncIdentity).toHaveBeenCalledWith('/project/android', {
        versionName: '3.15.0',
        versionCode: 73,
        displayName: '킥뉴스',
        iconPath: undefined,
      });
    });
  });

  describe('release signing', () => {
    beforeEach(() => {
      mockedPathExists.mockImplementation(async (target: string) =>
        target.endsWith('build.gradle')
      );
    });

    it('should prepare signing for release builds', async () => {
      (command as any).options = { profile: 'production', release: true };
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await expect(command['buildApp']('/project/android')).resolves.toBeUndefined();
      expect(mockedPrepareSigning).toHaveBeenCalledWith('/project/android');
      expect(mockedExec).toHaveBeenCalledWith('./gradlew', ['assembleRelease'], expect.anything());
    });

    it('should skip signing for debug builds', async () => {
      mockedExec.mockResolvedValue(await makeExecResult(true, 'BUILD SUCCESSFUL', ''));

      await command['buildApp']('/project/android');

      expect(mockedPrepareSigning).not.toHaveBeenCalled();
    });

    it('should fail the release build before Gradle runs when signing is missing', async () => {
      (command as any).options = { profile: 'production', release: true };
      mockedPrepareSigning.mockRejectedValue(
        new BuildFailedError('Release signing is not configured')
      );

      await expect(command['buildApp']('/project/android')).rejects.toThrow(
        'Release signing is not configured'
      );
      expect(mockedExec).not.toHaveBeenCalled();
    });
  });
});
