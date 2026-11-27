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

// Only what starts a process is mocked: the build runs against a real
// project, and the mocked Gradle reads its inputs from disk.
jest.mock('../utils/exec', () => ({
  ...jest.requireActual('../utils/exec'),
  executeCommand: jest.fn(),
  checkCommandExists: jest.fn(),
  requireTool: jest.fn(),
  signalProcessTree: jest.fn(),
}));

import fs from 'fs-extra';
import { AndroidBuildCommand } from '../commands/build/AndroidBuildCommand';
import { BuildFailedError } from '../core/errors';
import { executeCommand } from '../utils/exec';
import type { ExecResult } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { APP_LAUNCHER_HANDLER, writePluginFixture } from './helpers/plugin';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

const PRODUCTION_URL = 'https://app.example.com';
const GRADLE_OK: ExecResult = { success: true, stdout: 'BUILD SUCCESSFUL', stderr: '', code: 0 };
const CONFIG_FILE = 'app/src/main/assets/gyo-config.json';
const KEYSTORE_PROPERTIES = 'keystore.properties';

/** What a machine that releases holds. storeFile is resolved from android/app/. */
const SIGNING_ENV = {
  GYO_ANDROID_KEYSTORE_PATH: '../release.keystore',
  GYO_ANDROID_KEYSTORE_PASSWORD: 'store secret',
  GYO_ANDROID_KEY_ALIAS: 'app',
  GYO_ANDROID_KEY_PASSWORD: 'key secret',
};

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;

describe('AndroidBuildCommand', () => {
  let project: TestProject;
  let previousSigning: Record<string, string | undefined>;

  /** Runs `gyo build android` with the production profile, as `gyo build` does. */
  function build(release: boolean): Promise<void> {
    const command = new AndroidBuildCommand();
    command.setPlatform('android');
    command.setOptions({ profile: 'production', release });
    return command.runDirectly();
  }

  /**
   * Makes the mocked Gradle read the given files of android/ when it starts,
   * as the real one does. What they held then is what the build used.
   */
  function gradleReads(...files: string[]): Record<string, string> {
    const held: Record<string, string> = {};
    mockedExec.mockImplementation(async (command) => {
      if (command === './gradlew') {
        for (const file of files) {
          held[file] = fs.readFileSync(project.android(file), 'utf-8');
        }
      }
      return GRADLE_OK;
    });
    return held;
  }

  /** Gives a release build a keystore: the file the environment names, and the environment. */
  function signWithEnvironment(): void {
    fs.writeFileSync(
      project.android('release.keystore'),
      'Gradle is mocked: this need not be a keystore.'
    );
    Object.assign(process.env, SIGNING_ENV);
  }

  beforeEach(async () => {
    silenceLogger();
    // A release build signs with what the environment holds: a test starts without any.
    previousSigning = Object.fromEntries(
      Object.keys(SIGNING_ENV).map((name) => [name, process.env[name]])
    );
    for (const name of Object.keys(SIGNING_ENV)) {
      delete process.env[name];
    }

    project = await createTestProject();
    jest.clearAllMocks();
    await project.setConfig({ profiles: { production: { serverUrl: PRODUCTION_URL } } });
    mockedExec.mockResolvedValue(GRADLE_OK);
  });

  afterEach(() => {
    project.remove();
    for (const [name, value] of Object.entries(previousSigning)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('should stop when the project has no android/ directory', async () => {
    fs.removeSync(project.android());

    await expect(build(false)).rejects.toThrow(`Platform 'android' not found in ${project.path}.`);

    expect(executeCommand).not.toHaveBeenCalled();
  });

  describe('the project Gradle builds', () => {
    it('should write the server URL and the webview settings where the app reads them', async () => {
      await project.setConfig({ webview: { userAgent: 'MyApp/1.0' } });
      const held = gradleReads(CONFIG_FILE);

      await build(false);

      expect(JSON.parse(held[CONFIG_FILE])).toEqual({
        serverUrl: PRODUCTION_URL,
        webview: { userAgent: 'MyApp/1.0' },
      });
    });

    it('should write the version, the version code and the display name of gyo.config.json', async () => {
      await project.setConfig({
        version: '3.15.0',
        displayName: '킥뉴스',
        platforms: { android: { enabled: true, versionCode: 73 } },
      });
      const held = gradleReads('app/build.gradle', 'app/src/main/res/values/strings.xml');

      await build(false);

      expect(held['app/build.gradle']).toContain('versionCode = 73');
      expect(held['app/build.gradle']).toContain('versionName = "3.15.0"');
      expect(held['app/src/main/res/values/strings.xml']).toContain(
        '<string name="app_name">킥뉴스</string>'
      );
    });

    it('should include the installed plugins as Gradle modules before Gradle runs', async () => {
      writePluginFixture(
        project.path,
        '@gyo-framework/app-launcher',
        APP_LAUNCHER_HANDLER,
        'app_launcher'
      );
      const held = gradleReads('gyo.settings.gradle', 'app/gyo.build.gradle');

      await build(false);

      expect(held['gyo.settings.gradle']).toContain("include ':gyo-plugin-app-launcher'");
      expect(held['app/gyo.build.gradle']).toContain(
        "implementation project(':gyo-plugin-app-launcher')"
      );
    });

    it('should stop the build before Gradle when a plugin cannot be included', async () => {
      // Sources without a Gradle module file: the app build cannot include the plugin.
      writePluginFixture(
        project.path,
        '@gyo-framework/broken',
        'gyo.plugins.broken.BrokenBridge',
        'broken',
        { module: false }
      );

      await expect(build(false)).rejects.toThrow(
        '@gyo-framework/broken has Android sources but no android/build.gradle'
      );

      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('Gradle', () => {
    it('should run assembleDebug in android/ and report where the APK is', async () => {
      await build(false);

      expect(executeCommand).toHaveBeenCalledTimes(1);
      expect(executeCommand).toHaveBeenCalledWith('./gradlew', ['assembleDebug'], {
        cwd: project.android(),
        stdio: 'pipe',
      });
      expect(logger.info).toHaveBeenCalledWith(
        'APK location: android/app/build/outputs/apk/debug/app-debug.apk'
      );
    });

    it('should pass what Gradle printed to the verbose log', async () => {
      mockedExec.mockResolvedValue({ ...GRADLE_OK, stdout: 'BUILD SUCCESSFUL in 2s' });

      await build(false);

      expect(logger.verbose).toHaveBeenCalledWith('BUILD SUCCESSFUL in 2s');
    });

    it.each([
      {
        where: 'on stderr',
        result: {
          success: false,
          stdout: 'Starting a Gradle Daemon',
          stderr: 'FAILURE: Build failed with an exception.',
          code: 1,
        },
        shown: 'FAILURE: Build failed with an exception.',
      },
      {
        where: 'on stdout when stderr is empty',
        result: {
          success: false,
          stdout: 'FAILURE: Build failed with an exception.',
          stderr: '',
          code: 1,
        },
        shown: 'FAILURE: Build failed with an exception.',
      },
      {
        where: 'as Unknown error, when it printed nothing',
        result: { success: false, stdout: '', stderr: '', code: 1 },
        shown: 'Unknown error',
      },
    ])('should fail the build and show what Gradle printed $where', async ({ result, shown }) => {
      mockedExec.mockResolvedValue(result);

      const failing = build(false);
      await expect(failing).rejects.toThrow(BuildFailedError);
      await expect(failing).rejects.toThrow('Android build failed');

      expect(logger.error).toHaveBeenCalledWith(shown);
    });
  });

  describe('release signing', () => {
    it('should write keystore.properties from the environment before Gradle runs', async () => {
      signWithEnvironment();
      const held = gradleReads(KEYSTORE_PROPERTIES);

      await build(true);

      expect(held[KEYSTORE_PROPERTIES]).toBe(
        [
          'storeFile=../release.keystore',
          'storePassword=store secret',
          'keyAlias=app',
          'keyPassword=key secret',
          '',
        ].join('\n')
      );
      expect(executeCommand).toHaveBeenCalledWith('./gradlew', ['assembleRelease'], {
        cwd: project.android(),
        stdio: 'pipe',
      });
      expect(logger.info).toHaveBeenCalledWith(
        'APK location: android/app/build/outputs/apk/release/app-release.apk'
      );
    });

    it.each([
      {
        has: 'none',
        variables: {},
        message:
          /Release signing is not configured[\s\S]*GYO_ANDROID_KEYSTORE_PATH[\s\S]*keystore\.properties/,
      },
      {
        has: 'only some',
        variables: {
          GYO_ANDROID_KEYSTORE_PATH: '../release.keystore',
          GYO_ANDROID_KEY_PASSWORD: 'key secret',
        },
        message:
          /Release signing needs all four of GYO_ANDROID_KEYSTORE_PATH, GYO_ANDROID_KEYSTORE_PASSWORD, GYO_ANDROID_KEY_ALIAS, GYO_ANDROID_KEY_PASSWORD/,
      },
    ])(
      'should stop a release build before Gradle when it has $has of the signing variables',
      async ({ variables, message }) => {
        Object.assign(process.env, variables);

        await expect(build(true)).rejects.toThrow(message);

        expect(fs.pathExistsSync(project.android(KEYSTORE_PROPERTIES))).toBe(false);
        expect(executeCommand).not.toHaveBeenCalled();
      }
    );

    it('should build a debug APK without signing, whatever the environment holds', async () => {
      signWithEnvironment();

      await build(false);

      expect(executeCommand).toHaveBeenCalledWith(
        './gradlew',
        ['assembleDebug'],
        expect.anything()
      );
      expect(fs.pathExistsSync(project.android(KEYSTORE_PROPERTIES))).toBe(false);
    });
  });

  describe('a build that would load plain http', () => {
    it.each([
      {
        release: true,
        serverUrl: 'http://203.0.113.10',
        warning:
          'A release build does not load http://203.0.113.10: it denies plain http. Serve the profile over https.',
      },
      { release: true, serverUrl: 'https://app.example.com', warning: undefined },
      { release: true, serverUrl: 'http://localhost:3000', warning: undefined },
      { release: true, serverUrl: 'http://127.0.0.1:8080', warning: undefined },
      { release: false, serverUrl: 'http://203.0.113.10', warning: undefined },
    ])(
      'should warn about plain http only when a release build loads another machine (release: $release, $serverUrl)',
      async ({ release, serverUrl, warning }) => {
        await project.setConfig({ profiles: { production: { serverUrl } } });
        signWithEnvironment();

        await build(release);

        if (warning) {
          expect(logger.warn).toHaveBeenCalledWith(warning);
        } else {
          expect(logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('denies plain http')
          );
        }
      }
    );
  });
});
