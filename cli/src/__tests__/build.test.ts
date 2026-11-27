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
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    name: 'test',
    version: '1.0.0',
    platforms: { android: { enabled: true } },
  }),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  shouldStartLocalServer: jest.fn(),
}));

import { BuildCommand } from '../commands/build';
import { AndroidBuildCommand } from '../commands/build/AndroidBuildCommand';
import { IOSBuildCommand } from '../commands/build/IOSBuildCommand';

describe('BuildCommand', () => {
  let androidBuild: jest.SpyInstance;
  let iosBuild: jest.SpyInstance;

  function build(platform: string): Promise<void> {
    const command = new BuildCommand();
    command.setPositionalArgs([platform]);
    command.setOptions({ profile: 'production', release: true });
    return command.execute();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    androidBuild = jest
      .spyOn(AndroidBuildCommand.prototype, 'runDirectly')
      .mockResolvedValue(undefined);
    iosBuild = jest.spyOn(IOSBuildCommand.prototype, 'runDirectly').mockResolvedValue(undefined);
  });

  afterEach(() => {
    androidBuild.mockRestore();
    iosBuild.mockRestore();
  });

  it('should hand the platform and the options to the command that builds it', async () => {
    iosBuild.mockImplementation(function (this: IOSBuildCommand) {
      expect(this['platform']).toBe('ios');
      expect(this['options']).toMatchObject({ profile: 'production', release: true });
      return Promise.resolve();
    });

    await build('ios');

    expect(iosBuild).toHaveBeenCalledTimes(1);
    expect(androidBuild).not.toHaveBeenCalled();
  });

  it('should build android with the Android command', async () => {
    await build('android');

    expect(androidBuild).toHaveBeenCalledTimes(1);
    expect(iosBuild).not.toHaveBeenCalled();
  });

  it('should report a failure of the platform command', async () => {
    androidBuild.mockRejectedValue(new Error('build crash'));

    await expect(build('android')).rejects.toThrow('build crash');
  });

  it('should refuse a platform it cannot build, naming the ones it can', async () => {
    await expect(build('windows')).rejects.toThrow(
      'Invalid platform: windows. Valid platforms are: android, ios'
    );
    expect(androidBuild).not.toHaveBeenCalled();
    expect(iosBuild).not.toHaveBeenCalled();
  });
});
