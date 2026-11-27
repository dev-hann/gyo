import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { PlatformCommand } from '../commands/base/PlatformCommand';
import type { GyoConfig, Platform } from '../core/index';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

/** A command of one platform, as the build and run commands are built on the base. */
class ProjectCommand extends PlatformCommand {
  /** Where the base class was asked to write the shell's config. */
  configPath = '';
  /** What the base class handed `run()`; null when `run()` was not reached. */
  handed: { platform: Platform; config: GyoConfig | null } | null = null;

  protected async run(): Promise<void> {
    await this.checkPlatformDirectoryExists();
    await this.writeConfigFile(this.configPath, 'https://example.com', this.config?.webview);
    this.handed = { platform: this.platform, config: this.config };
  }
}

describe('PlatformCommand', () => {
  let project: TestProject;

  function command(): ProjectCommand {
    const created = new ProjectCommand();
    created.configPath = project.file('written/nested/gyo-config.json');
    return created;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    silenceLogger();
    project = await createTestProject();
  });

  afterEach(() => project.remove());

  describe('the project', () => {
    it('should be refused outside a project, saying what to run', async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-empty-'));
      const previousCwd = process.cwd();
      process.chdir(empty);

      try {
        await expect(command().runDirectly()).rejects.toThrow(
          /Not a gyo project[\s\S]*Run 'gyo create <project-name>'/
        );
      } finally {
        process.chdir(previousCwd);
        fs.removeSync(empty);
      }
    });

    it('should have its config read before the command runs', async () => {
      await project.setConfig({ displayName: '데모 앱' });
      const created = command();

      await created.runDirectly();

      expect(created.handed?.config).toMatchObject({ name: 'demo-app', displayName: '데모 앱' });
    });

    it('should be refused when its gyo.config.json is not valid', async () => {
      await fs.writeJson(project.file('gyo.config.json'), { name: 'demo-app' });
      const created = command();

      await expect(created.runDirectly()).rejects.toThrow('Invalid gyo.config.json');

      expect(created.handed).toBeNull();
    });
  });

  describe('a platform of the config', () => {
    it('should be refused when it is disabled, with the way to enable it', async () => {
      await project.setConfig({ platforms: { android: { enabled: false } } });
      const created = command();

      await expect(created.runDirectly()).rejects.toThrow(
        "Platform 'android' is disabled in gyo.config.json. Enable it: gyo config set platforms.android.enabled true"
      );

      expect(created.handed).toBeNull();
    });

    it.each([
      ['enabled', { android: { enabled: true } }],
      ['not mentioned', { ios: { enabled: true } }],
    ])('should run when the platform is %s', async (_case, platforms) => {
      await project.setConfig({ platforms });

      await expect(command().runDirectly()).resolves.toBeUndefined();
    });
  });

  describe('the platform directory', () => {
    it('should be refused when it is missing, saying what to run', async () => {
      fs.removeSync(project.android());
      const created = command();

      await expect(created.runDirectly()).rejects.toThrow(
        /Platform 'android' not found[\s\S]*Run 'gyo create' to initialize the project/
      );

      expect(created.handed).toBeNull();
    });

    it('should pass when it is there', async () => {
      await expect(command().runDirectly()).resolves.toBeUndefined();
    });
  });

  describe('writeConfigFile', () => {
    it('should write the server URL and the settings the shell has to apply, making the directory', async () => {
      const created = command();

      await created.runDirectly();

      expect(fs.readJsonSync(created.configPath)).toEqual({
        serverUrl: 'https://example.com',
        webview: { allowFileAccess: false, allowUniversalAccessFromFileURLs: false },
      });
    });

    it('should write the server URL alone when no setting applies', async () => {
      await project.setConfig({ webview: { userAgent: 'gyo-webview/1.0' } });
      const created = command();

      await created.runDirectly();

      expect(fs.readJsonSync(created.configPath)).toEqual({ serverUrl: 'https://example.com' });
    });
  });
});
