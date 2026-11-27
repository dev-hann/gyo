import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { InstallCommand } from '../commands/install';
import {
  APP_LAUNCHER_HANDLER,
  SMS_SENDER_HANDLER,
  syncedHandlerSources,
  writeMainActivity,
  writePluginFixture,
} from './helpers/plugin';

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setVerbose: jest.fn(),
  },
}));

const PACKAGE_NAME = 'com.example.demo';

describe('InstallCommand', () => {
  let projectPath: string;
  let previousCwd: string;
  let mainActivityPath: string;

  function readActivity(): string {
    return fs.readFileSync(mainActivityPath, 'utf-8');
  }

  beforeEach(() => {
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-install-'));
    previousCwd = process.cwd();
    process.chdir(projectPath);

    fs.outputJsonSync(path.join(projectPath, 'gyo.config.json'), {
      name: 'demo',
      version: '1.0.0',
      platforms: {},
    });
    mainActivityPath = writeMainActivity(projectPath, PACKAGE_NAME);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.removeSync(projectPath);
  });

  it('should fail outside a gyo project', async () => {
    process.chdir(os.tmpdir());
    const command = new InstallCommand();
    command.setOptions({});

    await expect(command['run']()).rejects.toThrow('Not a gyo project');
  });

  it('should copy a plugin and register it from MainActivity', async () => {
    writePluginFixture(
      projectPath,
      '@gyo-framework/app-launcher',
      APP_LAUNCHER_HANDLER,
      'app_launcher'
    );
    const command = new InstallCommand();
    command.setOptions({});

    await command['run']();

    expect(
      fs.pathExistsSync(
        path.join(syncedHandlerSources(projectPath, APP_LAUNCHER_HANDLER), 'AppLauncherBridge.kt')
      )
    ).toBe(true);
    expect(readActivity()).toContain('import gyo.plugins.bridge.PluginRegistry');
    expect(readActivity()).toContain('PluginRegistry.registerAll(this)');
  });

  it('should remove what the last plugin left behind once it is uninstalled', async () => {
    const plugin = writePluginFixture(
      projectPath,
      '@gyo-framework/sms-sender',
      SMS_SENDER_HANDLER,
      'sms_sender'
    );
    const command = new InstallCommand();
    command.setOptions({});

    await command['run']();

    fs.removeSync(plugin.path);

    await command['run']();

    expect(fs.pathExistsSync(syncedHandlerSources(projectPath, SMS_SENDER_HANDLER))).toBe(false);
    expect(
      fs.pathExistsSync(
        path.join(projectPath, 'android/app/src/main/java/gyo/plugins/bridge/PluginRegistry.kt')
      )
    ).toBe(false);
    expect(readActivity()).not.toContain('PluginRegistry');
  });
});
