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
  getTemplatesPath: jest.fn(),
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    name: 'test',
    version: '1.0.0',
    platforms: { android: { enabled: true } },
  }),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn(),
  shouldStartLocalServer: jest.fn(),
}));

import { BuildCommand } from '../commands/build';
import { AndroidBuildCommand } from '../commands/build/AndroidBuildCommand';
import { IOSBuildCommand } from '../commands/build/IOSBuildCommand';
import { InvalidPlatformError } from '../core/index';

describe('BuildCommand', () => {
  it('should create AndroidBuildCommand for android platform', () => {
    const command = new BuildCommand();
    const result = command['createCommand']('android');
    expect(result.constructor.name).toBe('AndroidBuildCommand');
  });

  it('should create IOSBuildCommand for ios platform', () => {
    const command = new BuildCommand();
    const result = command['createCommand']('ios');
    expect(result.constructor.name).toBe('IOSBuildCommand');
  });

  it('should throw InvalidPlatformError for unknown platform', () => {
    const command = new BuildCommand();
    expect(() => command['createCommand']('windows' as any)).toThrow(InvalidPlatformError);
  });

  it('should set platform', () => {
    const command = new BuildCommand();
    command.setPlatform('ios');
    expect(command['platform']).toBe('ios');
  });

  describe('run', () => {
    let runDirectlySpy: jest.SpyInstance;

    afterEach(() => {
      if (runDirectlySpy) {
        runDirectlySpy.mockRestore();
      }
    });

    it('should delegate to AndroidBuildCommand.runDirectly for android', async () => {
      runDirectlySpy = jest
        .spyOn(AndroidBuildCommand.prototype, 'runDirectly')
        .mockResolvedValue(undefined);

      const command = new BuildCommand();
      command.setPlatform('android');
      command.setOptions({ profile: 'development', release: false });

      await command['run']();

      expect(runDirectlySpy).toHaveBeenCalledTimes(1);
    });

    it('should delegate to IOSBuildCommand.runDirectly for ios', async () => {
      runDirectlySpy = jest
        .spyOn(IOSBuildCommand.prototype, 'runDirectly')
        .mockResolvedValue(undefined);

      const command = new BuildCommand();
      command.setPlatform('ios');
      command.setOptions({ profile: 'production', release: true });

      await command['run']();

      expect(runDirectlySpy).toHaveBeenCalledTimes(1);
    });

    it('should pass options to the sub-command', async () => {
      runDirectlySpy = jest
        .spyOn(AndroidBuildCommand.prototype, 'runDirectly')
        .mockImplementation(function (this: AndroidBuildCommand) {
          expect(this['options'].profile).toBe('staging');
          expect(this['options'].release).toBe(true);
          return Promise.resolve();
        });

      const command = new BuildCommand();
      command.setPlatform('android');
      command.setOptions({ profile: 'staging', release: true });

      await command['run']();
    });

    it('should propagate errors from runDirectly', async () => {
      runDirectlySpy = jest
        .spyOn(AndroidBuildCommand.prototype, 'runDirectly')
        .mockRejectedValue(new Error('build crash'));

      const command = new BuildCommand();
      command.setPlatform('android');
      command.setOptions({ profile: 'development', release: false });

      await expect(command['run']()).rejects.toThrow('build crash');
    });
  });
});
