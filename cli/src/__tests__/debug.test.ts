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

import { DebugCommand } from '../commands/debug';
import { logger } from '../utils/logger';

describe('DebugCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct meta with name and description', () => {
    const command = new DebugCommand();
    const meta = command.getMeta();

    expect(meta.name).toBe('debug <platform>');
    expect(meta.description).toBe('Launch debugger for the specified platform');
  });

  it('should return android and ios as valid platforms', () => {
    const command = new DebugCommand();

    expect(command['getValidPlatforms']()).toEqual(['android', 'ios']);
  });

  it('should show android debug info when platform is android', async () => {
    const mockOpen = jest.fn().mockResolvedValue(undefined);
    jest.doMock('open', () => ({ default: mockOpen }));

    const command = new DebugCommand();
    command.setPlatform('android');

    await command['run']();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Chrome DevTools'));
  });

  it('should warn when open fails for android', async () => {
    const mockOpen = jest.fn().mockRejectedValue(new Error('no browser'));
    jest.doMock('open', () => ({ default: mockOpen }));

    const command = new DebugCommand();
    command.setPlatform('android');

    await command['run']();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not auto-open'));
  });

  it('should show ios debug info when platform is ios', async () => {
    const command = new DebugCommand();
    command.setPlatform('ios');

    await command['run']();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Safari Web Inspector'));
  });
});
