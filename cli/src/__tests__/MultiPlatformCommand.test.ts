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
  loadConfig: jest.fn().mockResolvedValue(null),
  validateConfig: jest.fn(),
  saveConfig: jest.fn(),
  getProfileUrl: jest.fn(),
  shouldStartLocalServer: jest.fn(),
}));

import { MultiPlatformCommand } from '../commands/base/MultiPlatformCommand';
import { CommandMeta } from '../commands/base/BaseCommand';

class TestableMultiCommand extends MultiPlatformCommand {
  getMeta(): CommandMeta {
    return { name: 'test-multi', description: 'test' };
  }

  protected getValidPlatforms(): string[] {
    return ['android', 'ios', 'lib', 'all'];
  }

  protected run(): Promise<void> {
    return Promise.resolve();
  }
}

describe('MultiPlatformCommand', () => {
  let command: TestableMultiCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableMultiCommand();
  });

  describe('validatePlatform', () => {
    it('should pass for valid platform', () => {
      command.setPlatform('android');
      expect(() => command['validatePlatform']()).not.toThrow();
    });

    it('should pass for all', () => {
      command.setPlatform('all');
      expect(() => command['validatePlatform']()).not.toThrow();
    });

    it('should throw for invalid platform', () => {
      command.setPlatform('windows');
      expect(() => command['validatePlatform']()).toThrow();
    });
  });

  describe('getPlatformsToProcess', () => {
    it('should return all platforms except "all" when platform is "all"', () => {
      command.setPlatform('all');
      const result = command['getPlatformsToProcess']();
      expect(result).toEqual(['android', 'ios', 'lib']);
    });

    it('should return single platform when not "all"', () => {
      command.setPlatform('android');
      const result = command['getPlatformsToProcess']();
      expect(result).toEqual(['android']);
    });
  });

  describe('processAllPlatforms', () => {
    it('should call processor for each platform in parallel', async () => {
      command.setPlatform('all');
      const processor = jest.fn().mockResolvedValue(undefined);

      await command['processAllPlatforms'](processor);

      expect(processor).toHaveBeenCalledTimes(3);
      expect(processor).toHaveBeenCalledWith('android');
      expect(processor).toHaveBeenCalledWith('ios');
      expect(processor).toHaveBeenCalledWith('lib');
    });
  });

  describe('processPlatformsSequentially', () => {
    it('should call processor for each platform in order', async () => {
      command.setPlatform('all');
      const order: string[] = [];
      const processor = jest.fn().mockImplementation((p: string) => {
        order.push(p);
        return Promise.resolve();
      });

      await command['processPlatformsSequentially'](processor);

      expect(order).toEqual(['android', 'ios', 'lib']);
    });
  });
});
