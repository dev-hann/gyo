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
});
