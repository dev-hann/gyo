import * as os from 'os';
import * as path from 'path';
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
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { androidFilePath, writeAndroidShell } from './helpers/plugin';

/** What a machine that releases holds. Gradle resolves storeFile from android/app/. */
const SIGNING_ENV = {
  GYO_ANDROID_KEYSTORE_PATH: 'release.keystore',
  GYO_ANDROID_KEYSTORE_PASSWORD: 'store secret',
  GYO_ANDROID_KEY_ALIAS: 'app',
  GYO_ANDROID_KEY_PASSWORD: 'key secret',
};

const SIGNING_PROPERTIES = [
  'storeFile=release.keystore',
  'storePassword=store secret',
  'keyAlias=app',
  'keyPassword=key secret',
  '',
].join('\n');

/** A 1×1 PNG: the sync copies an icon, it does not decode one. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * A project with the Android shell `gyo create` gives it, in a directory of
 * its own. A test makes it what it needs with plain fs, and reads back from
 * disk what the service wrote.
 */
function writeProject(): string {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-android-shell-'));
  writeAndroidShell(projectPath, 'com.example.app');
  return projectPath;
}

beforeEach(() => {
  silenceLogger();
  jest.clearAllMocks();
});

describe('toXmlText', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&apos;'],
    [`Tom & "Jerry" <3>`, 'Tom &amp; &quot;Jerry&quot; &lt;3&gt;'],
  ])('should escape %s as %s', (text, escaped) => {
    expect(toXmlText(text)).toBe(escaped);
  });
});

describe('toJavaPropertyValue', () => {
  it.each([
    ['backslashes', 'C:\\temp', 'C:\\\\temp'],
    ['line breaks', 'first\nsecond', 'first\\nsecond'],
    ['carriage returns', 'first\rsecond', 'first\\rsecond'],
    ['tabs', 'first\tsecond', 'first\\tsecond'],
    ['a leading space', ' secret', '\\ secret'],
    // Java reads a properties file as ISO 8859-1, and the file is written as UTF-8.
    ['characters outside Latin-1', '비밀번호', '\\ube44\\ubc00\\ubc88\\ud638'],
  ])('should escape %s', (_what, value, escaped) => {
    expect(toJavaPropertyValue(value)).toBe(escaped);
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

  it('should escape each value the way a Java properties file is read', () => {
    expect(
      renderKeystoreProperties({
        storeFile: 'C:\\keys\\release.keystore',
        storePassword: 'first\nsecond',
        keyAlias: 'app',
        keyPassword: 'key secret',
      })
    ).toBe(
      [
        'storeFile=C:\\\\keys\\\\release.keystore',
        'storePassword=first\\nsecond',
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

  it('should return undefined when the variables are set but blank', () => {
    expect(
      readSigningFromEnv({ GYO_ANDROID_KEYSTORE_PATH: '', GYO_ANDROID_KEY_PASSWORD: '  ' })
    ).toBeUndefined();
  });

  it('should collect the four variables', () => {
    expect(readSigningFromEnv(SIGNING_ENV)).toEqual({
      storeFile: 'release.keystore',
      storePassword: 'store secret',
      keyAlias: 'app',
      keyPassword: 'key secret',
    });
  });

  it('should trim what the variables hold', () => {
    expect(
      readSigningFromEnv({ ...SIGNING_ENV, GYO_ANDROID_KEYSTORE_PATH: ' release.keystore\n' })
    ).toMatchObject({ storeFile: 'release.keystore' });
  });

  it('should reject a partial set', () => {
    expect(() => readSigningFromEnv({ GYO_ANDROID_KEYSTORE_PATH: 'ks.jks' })).toThrow(
      'Release signing needs all four of GYO_ANDROID_KEYSTORE_PATH, GYO_ANDROID_KEYSTORE_PASSWORD, GYO_ANDROID_KEY_ALIAS, GYO_ANDROID_KEY_PASSWORD.'
    );
  });
});

describe('prepareReleaseSigning', () => {
  let projectPath: string;
  let androidPath: string;

  const propertiesPath = (): string => path.join(androidPath, 'keystore.properties');
  const keystorePath = (): string => path.join(androidPath, 'app', 'release.keystore');

  /** Gives the project the file the environment names. */
  const writeKeystore = (): void => fs.writeFileSync(keystorePath(), 'a keystore');

  beforeEach(() => {
    projectPath = writeProject();
    androidPath = androidFilePath(projectPath);
  });

  afterEach(() => {
    fs.removeSync(projectPath);
  });

  it('should write keystore.properties from the environment variables', async () => {
    writeKeystore();

    await prepareReleaseSigning(androidPath, SIGNING_ENV);

    expect(fs.readFileSync(propertiesPath(), 'utf-8')).toBe(SIGNING_PROPERTIES);
    expect(logger.verbose).toHaveBeenCalledWith(`Wrote ${propertiesPath()} from the environment`);
  });

  it('should reject when the keystore named by the environment is missing', async () => {
    await expect(prepareReleaseSigning(androidPath, SIGNING_ENV)).rejects.toThrow(
      `Release keystore not found: ${keystorePath()}`
    );

    expect(fs.pathExistsSync(propertiesPath())).toBe(false);
  });

  it('should accept an existing keystore.properties when no variable is set', async () => {
    const byHand = 'storeFile=made-by-hand.keystore\nstorePassword=...\n';
    fs.writeFileSync(propertiesPath(), byHand);

    await expect(prepareReleaseSigning(androidPath, {})).resolves.toBeUndefined();

    expect(fs.readFileSync(propertiesPath(), 'utf-8')).toBe(byHand);
  });

  it('should let the environment win over a keystore.properties made by hand', async () => {
    fs.writeFileSync(propertiesPath(), 'storeFile=made-by-hand.keystore\n');
    writeKeystore();

    await prepareReleaseSigning(androidPath, SIGNING_ENV);

    expect(fs.readFileSync(propertiesPath(), 'utf-8')).toBe(SIGNING_PROPERTIES);
  });

  it('should name both ways to configure signing when there is nothing', async () => {
    await expect(prepareReleaseSigning(androidPath, {})).rejects.toThrow(
      /Release signing is not configured[\s\S]*GYO_ANDROID_KEYSTORE_PATH[\s\S]*keystore\.properties/
    );

    expect(fs.pathExistsSync(propertiesPath())).toBe(false);
  });
});

describe('toAndroidAppIdentity', () => {
  it('should map the config onto the Android identity', () => {
    const android: GyoConfig['platforms']['android'] = {
      enabled: true,
      versionCode: 73,
      icon: './assets/icon.png',
    };
    const config: GyoConfig = {
      name: 'keek-news',
      version: '3.15.0',
      displayName: '킥뉴스',
      platforms: { android },
    };

    expect(toAndroidAppIdentity(config, '/proj')).toEqual({
      versionName: '3.15.0',
      versionCode: 73,
      displayName: '킥뉴스',
      iconPath: '/proj/assets/icon.png',
    });
  });

  it('should leave the version code, the display name and the icon out when the config sets none', () => {
    const config: GyoConfig = { name: 'keek-news', version: '3.15.0', platforms: {} };

    expect(toAndroidAppIdentity(config, '/proj')).toStrictEqual({
      versionName: '3.15.0',
      versionCode: undefined,
      displayName: undefined,
      iconPath: undefined,
    });
  });
});

describe('syncAndroidAppIdentity', () => {
  let projectPath: string;
  let androidPath: string;

  const GRADLE = 'app/build.gradle';
  const STRINGS = 'app/src/main/res/values/strings.xml';
  const MANIFEST = 'app/src/main/AndroidManifest.xml';
  const ICON = 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';

  const read = (file: string): string =>
    fs.readFileSync(androidFilePath(projectPath, file), 'utf-8');

  const fileTime = (file: string): number =>
    fs.statSync(androidFilePath(projectPath, file)).mtimeMs;

  /**
   * Rewrites a file of the shell with a snippet replaced, as a project made
   * by an earlier gyo, or edited by hand, holds it. Returns what it holds.
   */
  function edit(file: string, search: string, replacement: string): string {
    const content = read(file).replace(search, replacement);
    fs.writeFileSync(androidFilePath(projectPath, file), content);
    return content;
  }

  /** Moves a file's modification time into the past: a file the sync leaves alone keeps it. */
  function age(file: string): number {
    const longAgo = new Date('2000-01-01T00:00:00Z');
    fs.utimesSync(androidFilePath(projectPath, file), longAgo, longAgo);
    return longAgo.getTime();
  }

  /** Writes an icon where gyo.config.json names one: in the project, outside android/. */
  function writeIcon(name = 'icon.png'): string {
    const iconPath = path.join(projectPath, 'assets', name);
    fs.outputFileSync(iconPath, PNG);
    return iconPath;
  }

  beforeEach(() => {
    projectPath = writeProject();
    androidPath = androidFilePath(projectPath);
  });

  afterEach(() => {
    fs.removeSync(projectPath);
  });

  describe('the version in build.gradle', () => {
    it('should write the version into build.gradle', async () => {
      const before = read(GRADLE);

      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', versionCode: 73 });

      expect(read(GRADLE)).toBe(
        before
          .replace('versionCode = 1', 'versionCode = 73')
          .replace('versionName = "1.0"', 'versionName = "3.15.0"')
      );
    });

    it('should keep the version code when none is configured', async () => {
      const before = read(GRADLE);

      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0' });

      expect(read(GRADLE)).toBe(before.replace('versionName = "1.0"', 'versionName = "3.15.0"'));
    });

    it('should keep a quote in the version from ending the Gradle string', async () => {
      await syncAndroidAppIdentity(androidPath, { versionName: '1.0 "beta"' });

      expect(read(GRADLE)).toContain('versionName = "1.0 \\"beta\\""');
    });

    it.each([
      { line: 'versionCode = 1', earlier: 'versionCode 1', written: 'versionCode 73' },
      {
        line: 'versionName = "1.0"',
        earlier: 'versionName "1.0"',
        written: 'versionName "3.15.0"',
      },
    ])(
      'should keep how $line is written in a project made by an earlier gyo',
      async ({ line, earlier, written }) => {
        edit(GRADLE, line, earlier);

        await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', versionCode: 73 });

        expect(read(GRADLE)).toContain(written);
      }
    );

    it.each([
      { line: 'versionCode = 1', missing: '"versionCode <number>" line' },
      { line: 'versionName = "1.0"', missing: '"versionName" line' },
    ])(
      'should fail clearly when build.gradle has no $line line to update',
      async ({ line, missing }) => {
        edit(GRADLE, line, '');

        await expect(
          syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', versionCode: 73 })
        ).rejects.toThrow(`${androidFilePath(projectPath, GRADLE)} has no ${missing} to update.`);
      }
    );
  });

  describe('the app label', () => {
    it('should write the display name into strings.xml', async () => {
      await syncAndroidAppIdentity(androidPath, {
        versionName: '3.15.0',
        displayName: 'Tom & "Jerry"',
      });

      expect(read(STRINGS)).toBe(
        '<resources>\n    <string name="app_name">Tom &amp; &quot;Jerry&quot;</string>\n</resources>\n'
      );
    });

    // A `$` starts a group reference in a replacement string; the name has to come out as written.
    it.each([
      ['a dollar and a digit', 'Shop $1'],
      ['a dollar and an ampersand', 'Cash $& Carry'],
      ['a dollar and an apostrophe', "Don't $'"],
    ])('should write a display name with %s as it is', async (_what, displayName) => {
      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', displayName });

      expect(read(STRINGS)).toBe(
        `<resources>\n    <string name="app_name">${toXmlText(displayName)}</string>\n</resources>\n`
      );
    });

    it('should leave the manifest alone when it already uses the string resource', async () => {
      const before = read(MANIFEST);
      const written = age(MANIFEST);

      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', displayName: 'New' });

      expect(read(MANIFEST)).toBe(before);
      expect(fileTime(MANIFEST)).toBe(written);
    });

    it('should point the manifest at the string resource when an earlier gyo put the name into it', async () => {
      const before = edit(MANIFEST, 'android:label="@string/app_name"', 'android:label="demo"');

      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', displayName: 'New' });

      expect(read(MANIFEST)).toBe(
        before.replace('android:label="demo"', 'android:label="@string/app_name"')
      );
    });

    it('should leave the label alone when no display name is configured', async () => {
      const before = read(STRINGS);
      const written = age(STRINGS);

      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0' });

      expect(read(STRINGS)).toBe(before);
      expect(fileTime(STRINGS)).toBe(written);
    });

    it.each([
      {
        file: STRINGS,
        without: '<string name="app_name">demo</string>',
        missing: 'app_name string',
      },
      {
        file: MANIFEST,
        without: 'android:label="@string/app_name"',
        missing: 'android:label attribute',
      },
    ])(
      'should fail clearly when $file has no $missing to update',
      async ({ file, without, missing }) => {
        edit(file, without, '');

        await expect(
          syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', displayName: 'New' })
        ).rejects.toThrow(`${androidFilePath(projectPath, file)} has no ${missing} to update.`);
      }
    );
  });

  describe('the launcher icon', () => {
    it('should copy the icon and point the manifest at it', async () => {
      const before = read(MANIFEST);

      await syncAndroidAppIdentity(androidPath, {
        versionName: '3.15.0',
        iconPath: writeIcon(),
      });

      expect(fs.readFileSync(androidFilePath(projectPath, ICON))).toEqual(PNG);
      expect(read(MANIFEST)).toBe(
        before.replace(
          'android:icon="@android:drawable/sym_def_app_icon"',
          'android:icon="@mipmap/ic_launcher"'
        )
      );
    });

    it('should replace the icon an earlier build copied', async () => {
      const iconPath = writeIcon();
      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', iconPath });
      // The file behind the icon has changed since that build.
      fs.writeFileSync(iconPath, 'a new design');

      await syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', iconPath });

      expect(fs.readFileSync(androidFilePath(projectPath, ICON), 'utf-8')).toBe('a new design');
    });

    it('should accept an icon whose extension is upper case', async () => {
      await syncAndroidAppIdentity(androidPath, {
        versionName: '3.15.0',
        iconPath: writeIcon('ICON.PNG'),
      });

      expect(fs.readFileSync(androidFilePath(projectPath, ICON))).toEqual(PNG);
    });

    it('should reject an icon that does not exist', async () => {
      const iconPath = path.join(projectPath, 'assets', 'icon.png');

      await expect(
        syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', iconPath })
      ).rejects.toThrow(`Launcher icon not found: ${iconPath}`);

      expect(fs.pathExistsSync(androidFilePath(projectPath, ICON))).toBe(false);
    });

    it('should reject an icon that is not a PNG', async () => {
      const iconPath = writeIcon('icon.jpg');

      await expect(
        syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', iconPath })
      ).rejects.toThrow(`The launcher icon must be a PNG file: ${iconPath}`);

      expect(fs.pathExistsSync(androidFilePath(projectPath, ICON))).toBe(false);
    });

    it('should fail clearly when the manifest has no android:icon attribute to update', async () => {
      edit(MANIFEST, 'android:icon="@android:drawable/sym_def_app_icon"', '');

      await expect(
        syncAndroidAppIdentity(androidPath, { versionName: '3.15.0', iconPath: writeIcon() })
      ).rejects.toThrow(
        `${androidFilePath(projectPath, MANIFEST)} has no android:icon attribute to update.`
      );
    });
  });
});
