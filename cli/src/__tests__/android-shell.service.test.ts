jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    verbose: jest.fn(),
    setVerbose: jest.fn(),
    isVerbose: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn(),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  copyDir: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  removeDir: jest.fn(),
  getTemplatesPath: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  copy: jest.fn().mockResolvedValue(undefined),
}));

import fs from 'fs-extra';
import {
  prepareReleaseSigning,
  readSigningFromEnv,
  renderKeystoreProperties,
  syncAndroidAppIdentity,
  toAndroidAppIdentity,
  toJavaPropertyValue,
  toXmlText,
} from '../services/android-shell.service';
import type { GyoConfig } from '../core/index';
import { pathExists, readFile, writeFile } from '../utils/fs';

const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedCopy = fs.copy as jest.MockedFunction<typeof fs.copy>;

const ANDROID = '/project/android';
const GRADLE = [
  'android {',
  '    defaultConfig {',
  '        versionCode 1',
  '        versionName "1.0.0"',
  '    }',
  '}',
].join('\n');
const STRINGS = '<resources>\n    <string name="app_name">old name</string>\n</resources>';
const MANIFEST =
  '<application\n        android:icon="@android:drawable/sym_def_app_icon"\n        android:label="{{PROJECT_NAME}}" />';
const SIGNING_ENV = {
  GYO_ANDROID_KEYSTORE_PATH: 'release.keystore',
  GYO_ANDROID_KEYSTORE_PASSWORD: 'store secret',
  GYO_ANDROID_KEY_ALIAS: 'app',
  GYO_ANDROID_KEY_PASSWORD: 'key secret',
};

/** The files of a freshly generated Android project, as the sync reads them. */
function mockGeneratedProject(overrides: { gradle?: string } = {}): void {
  mockedReadFile.mockImplementation(async (file: string) => {
    if (file.endsWith('build.gradle')) return overrides.gradle ?? GRADLE;
    if (file.endsWith('strings.xml')) return STRINGS;
    if (file.endsWith('AndroidManifest.xml')) return MANIFEST;
    throw new Error(`unexpected read: ${file}`);
  });
  mockedPathExists.mockResolvedValue(true);
}

function written(fileSuffix: string): string {
  const call = mockedWriteFile.mock.calls.find(([file]) => file.endsWith(fileSuffix));
  if (!call) throw new Error(`nothing written for ${fileSuffix}`);
  return call[1] as string;
}

describe('toXmlText', () => {
  it('should escape XML special characters', () => {
    expect(toXmlText(`Tom & "Jerry" <3>`)).toBe('Tom &amp; &quot;Jerry&quot; &lt;3&gt;');
  });
});

describe('toJavaPropertyValue', () => {
  it('should escape backslashes', () => {
    expect(toJavaPropertyValue('C:\\temp')).toBe('C:\\\\temp');
  });

  it('should escape line breaks', () => {
    expect(toJavaPropertyValue('first\nsecond')).toBe('first\\nsecond');
  });
});

describe('renderKeystoreProperties', () => {
  it('should write one property per line', () => {
    expect(
      renderKeystoreProperties({
        storeFile: 'release.keystore',
        storePassword: 'p=1',
        keyAlias: 'app',
        keyPassword: 'key secret',
      })
    ).toBe(
      [
        'storeFile=release.keystore',
        'storePassword=p=1',
        'keyAlias=app',
        'keyPassword=key secret',
        '',
      ].join('\n')
    );
  });
});

describe('readSigningFromEnv', () => {
  it('should return undefined when no variable is set', () => {
    expect(readSigningFromEnv({})).toBeUndefined();
  });

  it('should collect the four variables', () => {
    expect(readSigningFromEnv(SIGNING_ENV)).toEqual({
      storeFile: 'release.keystore',
      storePassword: 'store secret',
      keyAlias: 'app',
      keyPassword: 'key secret',
    });
  });

  it('should reject a partial set', () => {
    expect(() => readSigningFromEnv({ GYO_ANDROID_KEYSTORE_PATH: 'ks.jks' })).toThrow('all four');
  });
});

describe('prepareReleaseSigning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should write keystore.properties from the environment variables', async () => {
    mockedPathExists.mockImplementation(async (file: string) =>
      file.endsWith('/app/release.keystore')
    );

    await prepareReleaseSigning(ANDROID, SIGNING_ENV);

    expect(written('keystore.properties')).toBe(
      [
        'storeFile=release.keystore',
        'storePassword=store secret',
        'keyAlias=app',
        'keyPassword=key secret',
        '',
      ].join('\n')
    );
  });

  it('should reject when the keystore named by the environment is missing', async () => {
    mockedPathExists.mockResolvedValue(false);

    await expect(prepareReleaseSigning(ANDROID, SIGNING_ENV)).rejects.toThrow(
      '/project/android/app/release.keystore'
    );
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it('should accept an existing keystore.properties when no variable is set', async () => {
    mockedPathExists.mockImplementation(async (file: string) =>
      file.endsWith('keystore.properties')
    );

    await expect(prepareReleaseSigning(ANDROID, {})).resolves.toBeUndefined();
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it('should name both ways to configure signing when there is nothing', async () => {
    mockedPathExists.mockResolvedValue(false);

    await expect(prepareReleaseSigning(ANDROID, {})).rejects.toThrow('keystore.properties');
    await expect(prepareReleaseSigning(ANDROID, {})).rejects.toThrow('GYO_ANDROID_KEYSTORE_PATH');
  });
});

describe('toAndroidAppIdentity', () => {
  it('should map the config onto the Android identity', () => {
    const config = {
      name: 'keek-news',
      version: '3.15.0',
      displayName: '킥뉴스',
      platforms: {
        android: { enabled: true, versionCode: 73, icon: './assets/icon.png' },
      },
    };

    expect(toAndroidAppIdentity(config as GyoConfig, '/proj')).toEqual({
      versionName: '3.15.0',
      versionCode: 73,
      displayName: '킥뉴스',
      iconPath: '/proj/assets/icon.png',
    });
  });
});

describe('syncAndroidAppIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGeneratedProject();
  });

  it('should write the version into build.gradle', async () => {
    await syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0', versionCode: 73 });

    expect(written('build.gradle')).toContain('versionCode 73');
    expect(written('build.gradle')).toContain('versionName "3.15.0"');
  });

  it('should keep the version code when none is configured', async () => {
    await syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0' });

    expect(written('build.gradle')).toContain('versionCode 1');
  });

  it('should write the display name into strings.xml and point the manifest at it', async () => {
    await syncAndroidAppIdentity(ANDROID, {
      versionName: '3.15.0',
      displayName: 'Tom & "Jerry"',
    });

    expect(written('strings.xml')).toBe(
      '<resources>\n    <string name="app_name">Tom &amp; &quot;Jerry&quot;</string>\n</resources>'
    );
    expect(written('AndroidManifest.xml')).toContain('android:label="@string/app_name"');
  });

  it('should leave the manifest alone when it already uses the string resource', async () => {
    mockedReadFile.mockImplementation(async (file: string) => {
      if (file.endsWith('AndroidManifest.xml')) {
        return MANIFEST.replace('{{PROJECT_NAME}}', '@string/app_name');
      }
      return file.endsWith('build.gradle') ? GRADLE : STRINGS;
    });

    await syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0', displayName: 'New' });

    expect(mockedWriteFile.mock.calls.some(([file]) => file.endsWith('AndroidManifest.xml'))).toBe(
      false
    );
  });

  it('should leave the label alone when no display name is configured', async () => {
    await syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0' });

    expect(mockedWriteFile.mock.calls.some(([file]) => file.endsWith('strings.xml'))).toBe(false);
  });

  it('should copy the icon and point the manifest at it', async () => {
    await syncAndroidAppIdentity(ANDROID, {
      versionName: '3.15.0',
      iconPath: '/project/assets/icon.png',
    });

    expect(mockedCopy).toHaveBeenCalledWith(
      '/project/assets/icon.png',
      `${ANDROID}/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`,
      { overwrite: true }
    );
    expect(written('AndroidManifest.xml')).toContain('android:icon="@mipmap/ic_launcher"');
  });

  it('should reject an icon that does not exist', async () => {
    mockedPathExists.mockResolvedValue(false);

    await expect(
      syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0', iconPath: '/project/icon.png' })
    ).rejects.toThrow('/project/icon.png');
    expect(mockedCopy).not.toHaveBeenCalled();
  });

  it('should reject an icon that is not a PNG', async () => {
    await expect(
      syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0', iconPath: '/project/icon.jpg' })
    ).rejects.toThrow('PNG');
  });

  it('should fail clearly when build.gradle has no version to update', async () => {
    mockGeneratedProject({ gradle: 'android {\n    defaultConfig {\n    }\n}' });

    await expect(
      syncAndroidAppIdentity(ANDROID, { versionName: '3.15.0', versionCode: 73 })
    ).rejects.toThrow('versionCode');
  });
});
