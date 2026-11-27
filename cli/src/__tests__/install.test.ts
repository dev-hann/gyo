import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { InstallCommand } from '../commands/install';
import {
  APP_LAUNCHER_HANDLER,
  SMS_SENDER_HANDLER,
  androidFilePath,
  emptyRegistry,
  writeAndroidShell,
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

// The command runs against a real temporary project: it goes from the
// package in lib/node_modules to the files the Gradle build reads.
const PACKAGE_NAME = 'com.example.demo';
const REGISTRY = 'app/src/main/java/gyo/plugins/bridge/PluginRegistry.kt';

describe('InstallCommand', () => {
  let projectPath: string;
  let previousCwd: string;

  const readAndroid = (...relativePath: string[]): string =>
    fs.readFileSync(androidFilePath(projectPath, ...relativePath), 'utf-8');

  function install(): Promise<void> {
    const command = new InstallCommand();
    command.setOptions({});
    return command['run']();
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
    writeAndroidShell(projectPath, PACKAGE_NAME);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.removeSync(projectPath);
  });

  it('should fail outside a gyo project', async () => {
    process.chdir(os.tmpdir());

    await expect(install()).rejects.toThrow('Not a gyo project');
  });

  it('should include a plugin as a Gradle module and register it', async () => {
    writePluginFixture(
      projectPath,
      '@gyo-framework/app-launcher',
      APP_LAUNCHER_HANDLER,
      'app_launcher'
    );

    await install();

    expect(readAndroid('gyo.settings.gradle')).toContain("include ':gyo-plugin-app-launcher'");
    expect(readAndroid('app/gyo.build.gradle')).toContain(
      "implementation project(':gyo-plugin-app-launcher')"
    );
    expect(readAndroid(REGISTRY)).toContain(
      'BridgeRegistry.register("app_launcher", AppLauncherBridge(context))'
    );
  });

  it('should unregister the last plugin once it is uninstalled', async () => {
    const plugin = writePluginFixture(
      projectPath,
      '@gyo-framework/sms-sender',
      SMS_SENDER_HANDLER,
      'sms_sender'
    );
    await install();
    fs.removeSync(plugin.path);

    await install();

    expect(readAndroid(REGISTRY)).toBe(emptyRegistry());
    expect(readAndroid('gyo.settings.gradle')).not.toMatch(/^include /m);
    expect(readAndroid('app/gyo.build.gradle')).not.toContain('dependencies {');
  });
});
