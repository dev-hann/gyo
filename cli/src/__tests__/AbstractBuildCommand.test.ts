import fs from 'fs-extra';
import inquirer from 'inquirer';
import { AndroidBuildCommand } from '../commands/build/AndroidBuildCommand';
import { IOSBuildCommand } from '../commands/build/IOSBuildCommand';
import { BuildFailedError } from '../core/index';
import { WebServerService } from '../services/web-server.service';
import { checkCommandExists, executeCommand, requireTool } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

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

// Every command leaves the process; the files it reads and writes are real.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
  getGradlew: jest.requireActual('../utils/exec').getGradlew,
}));

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedCheck = checkCommandExists as jest.MockedFunction<typeof checkCommandExists>;
const mockedRequireTool = requireTool as jest.MockedFunction<typeof requireTool>;
const mockedPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

const ANDROID_CONFIG = 'android/app/src/main/assets/gyo-config.json';
const IOS_CONFIG = 'ios/Sources/Resources/gyo-config.json';

// What `gyo build` does before the platform part, through the commands that
// build each platform: `gyo build` runs them with `runDirectly()`.
describe('AbstractBuildCommand', () => {
  let project: TestProject;
  const terminal = process.stdin.isTTY;

  /** Builds Android for `profile`, as a debug build. */
  function buildAndroid(profile: string): Promise<void> {
    const command = new AndroidBuildCommand();
    command.setPlatform('android');
    command.setOptions({ profile, release: false });
    return command.runDirectly();
  }

  /** Every command the CLI ran, in order. */
  function ran(): string[] {
    return mockedExec.mock.calls.map(([command, args]) => `${command} ${(args ?? []).join(' ')}`);
  }

  function useTerminal(connected: boolean): void {
    Object.defineProperty(process.stdin, 'isTTY', { value: connected, configurable: true });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    silenceLogger();
    project = await createTestProject();
    await project.setConfig({
      profiles: {
        production: { serverUrl: 'https://example.com' },
        development: { serverUrl: 'http://localhost:3000' },
      },
    });

    mockedExec.mockResolvedValue({ success: true, stdout: '', stderr: '', code: 0 });
    mockedCheck.mockResolvedValue(true);
    mockedRequireTool.mockResolvedValue(undefined);
    // The machine's address, as `gyo run` finds it.
    jest
      .spyOn(WebServerService.prototype, 'resolveServerUrl')
      .mockResolvedValue('http://192.168.1.5:3000');
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: terminal, configurable: true });
    project.remove();
    jest.restoreAllMocks();
  });

  describe('the web app build', () => {
    it('should be skipped with a word when lib/ has no package.json', async () => {
      await buildAndroid('production');

      expect(ran()).toEqual(['./gradlew assembleDebug']);
      expect(logger.warn).toHaveBeenCalledWith(
        'lib/ directory or package.json not found, skipping lib build'
      );
    });

    it('should run in lib/ before Gradle', async () => {
      project.setWebApp({ build: 'vite build' });

      await buildAndroid('production');

      expect(mockedExec).toHaveBeenCalledWith('npm', ['run', 'build'], {
        cwd: project.lib(),
        stdio: 'pipe',
      });
      expect(ran()).toEqual(['npm run build', './gradlew assembleDebug']);
    });

    it('should stop the build when it fails, and say what went wrong', async () => {
      project.setWebApp({ build: 'vite build' });
      mockedExec.mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'vite: could not resolve',
        code: 1,
      });

      await expect(buildAndroid('production')).rejects.toThrow(BuildFailedError);

      expect(logger.error).toHaveBeenCalledWith('vite: could not resolve');
      expect(ran()).toEqual(['npm run build']);
    });
  });

  describe('the server the app is built for', () => {
    it('should come from the profile', async () => {
      await buildAndroid('production');

      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toMatchObject({
        serverUrl: 'https://example.com',
      });
      expect(mockedPrompt).not.toHaveBeenCalled();
    });

    it('should be this machine for a development build that says localhost', async () => {
      await buildAndroid('development');

      expect(WebServerService.prototype.resolveServerUrl).toHaveBeenCalledWith(
        'http://localhost:3000'
      );
      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toMatchObject({
        serverUrl: 'http://192.168.1.5:3000',
      });
    });

    it('should stay as written for a profile that starts no local server', async () => {
      await project.setConfig({ profiles: { production: { serverUrl: 'http://localhost:3000' } } });

      await buildAndroid('production');

      expect(WebServerService.prototype.resolveServerUrl).not.toHaveBeenCalled();
      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toMatchObject({
        serverUrl: 'http://localhost:3000',
      });
    });

    it('should stay as written when the profile names a machine', async () => {
      await project.setConfig({ profiles: { development: { serverUrl: 'http://10.0.2.2:3000' } } });

      await buildAndroid('development');

      expect(WebServerService.prototype.resolveServerUrl).not.toHaveBeenCalled();
      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toMatchObject({
        serverUrl: 'http://10.0.2.2:3000',
      });
    });

    it('should fail without a terminal when the profile names no server', async () => {
      useTerminal(false);
      await project.setConfig({
        profiles: { development: { serverUrl: 'http://localhost:3000' } },
      });

      await expect(buildAndroid('production')).rejects.toThrow(
        /Profile 'production' has no serverUrl in gyo.config.json.[\s\S]*Available profiles: development/
      );

      expect(mockedPrompt).not.toHaveBeenCalled();
      expect(ran()).toEqual([]);
    });

    it('should ask for the server where there is a terminal, and remember the answer', async () => {
      useTerminal(true);
      mockedPrompt.mockResolvedValueOnce({ url: 'https://prod.example.com' });
      await project.setConfig({
        profiles: { development: { serverUrl: 'http://localhost:3000' } },
      });

      await buildAndroid('production');

      const config = await fs.readJson(project.file('gyo.config.json'));
      expect(config.profiles.production.serverUrl).toBe('https://prod.example.com');
      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toMatchObject({
        serverUrl: 'https://prod.example.com',
      });
    });

    it('should take only an http or https address for an answer', async () => {
      useTerminal(true);
      mockedPrompt.mockResolvedValueOnce({ url: 'https://prod.example.com' });
      await project.setConfig({ profiles: {} });

      await buildAndroid('production');

      type Asked = Array<{ validate: (value: string) => true | string }>;
      const question = (mockedPrompt.mock.calls[0][0] as unknown as Asked)[0];
      expect(question.validate('prod.example.com')).toBe('URL must start with http:// or https://');
      expect(question.validate('https://prod.example.com')).toBe(true);
    });

    it('should refuse a project whose gyo.config.json is not valid, before anything runs', async () => {
      await fs.writeJson(project.file('gyo.config.json'), { name: 'demo-app' });

      await expect(buildAndroid('production')).rejects.toThrow('Invalid gyo.config.json');

      expect(ran()).toEqual([]);
    });
  });

  describe('the config the shell reads', () => {
    it('should be written where the Android shell reads it, making the directory', async () => {
      expect(fs.pathExistsSync(project.android('app/src/main/assets'))).toBe(false);

      await buildAndroid('production');

      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toMatchObject({
        serverUrl: 'https://example.com',
      });
    });

    it('should be written where the iOS shell reads it', async () => {
      mockedExec.mockImplementation((command: string) =>
        Promise.resolve(
          command === 'idevice_id'
            ? { success: true, stdout: 'abc123', stderr: '', code: 0 }
            : { success: true, stdout: '', stderr: '', code: 0 }
        )
      );
      const command = new IOSBuildCommand();
      command.setPlatform('ios');
      command.setOptions({ profile: 'production', release: false });

      await command.runDirectly();

      expect(fs.readJsonSync(project.file(IOS_CONFIG))).toMatchObject({
        serverUrl: 'https://example.com',
      });
    });

    it('should carry the webview settings a shell has to apply', async () => {
      await project.setConfig({ webview: { userAgent: 'MyApp/1.0', allowFileAccess: true } });

      await buildAndroid('production');

      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toEqual({
        serverUrl: 'https://example.com',
        webview: { userAgent: 'MyApp/1.0', allowFileAccess: true },
      });
    });

    it('should leave out what no shell has to apply', async () => {
      await project.setConfig({ webview: { userAgent: 'gyo-webview/1.0' } });

      await buildAndroid('production');

      expect(fs.readJsonSync(project.file(ANDROID_CONFIG))).toEqual({
        serverUrl: 'https://example.com',
      });
    });
  });
});
