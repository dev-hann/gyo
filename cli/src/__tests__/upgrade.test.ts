// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot
// run. Point the version at the real package.json instead, so that the test
// sees the version of the CLI whose sources are under test.
jest.mock('../utils/paths', () => ({
  getCliVersion: () =>
    jest
      .requireActual('fs-extra')
      .readJsonSync(jest.requireActual('path').join(__dirname, '../../package.json')).version,
}));

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../utils/exec', () => ({ executeCommand: jest.fn() }));

import * as path from 'path';
import fs from 'fs-extra';
import { UpgradeCommand } from '../commands/upgrade';
import { executeCommand } from '../utils/exec';
import type { ExecResult } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';

const mockedExec = jest.mocked(executeCommand);

const { version: installed }: { version: string } = fs.readJsonSync(
  path.join(__dirname, '../../package.json')
);
const [major, minor, patch] = installed.split('.').map(Number);
/** A version newer than the installed one. */
const released = `${major}.${minor}.${patch + 1}`;
/** A version to ask for with `--version`: neither the installed nor the latest one. */
const chosen = `${major}.${minor + 1}.0`;

function npm(stdout: string): ExecResult {
  return { success: true, stdout, stderr: '', code: 0 };
}

const NPM_UNREACHABLE: ExecResult = {
  success: false,
  stdout: '',
  stderr: 'network error',
  code: 1,
};

/** `gyo upgrade` with its options, as Commander hands them over. */
function upgrade(options: { check?: boolean; version?: string } = {}): Promise<void> {
  const command = new UpgradeCommand();
  command.setOptions(options);
  return command.execute();
}

const view = ['view', '@gyo-framework/cli', 'version'];

describe('UpgradeCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('gyo upgrade', () => {
    it('should install the newer version npm has, and report the upgrade', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${released}\n`)).mockResolvedValueOnce(npm(''));

      await upgrade();

      expect(mockedExec).toHaveBeenNthCalledWith(1, 'npm', view, { stdio: 'pipe' });
      expect(mockedExec).toHaveBeenNthCalledWith(
        2,
        'npm',
        ['install', '-g', `@gyo-framework/cli@${released}`],
        { stdio: 'inherit' }
      );
      expect(logger.info).toHaveBeenCalledWith(`Current version: ${installed}`);
      expect(logger.info).toHaveBeenCalledWith(`Latest version:  ${released}`);
      expect(logger.success).toHaveBeenCalledWith(`\nSuccessfully upgraded to v${released}!`);
    });

    it('should say it is up to date when npm has the installed version', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${installed}\n`));

      await upgrade();

      expect(logger.success).toHaveBeenCalledWith('\nAlready up to date!');
      expect(mockedExec).toHaveBeenCalledTimes(1);
    });

    it('should fail when npm cannot install the new version', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${released}\n`)).mockResolvedValueOnce(NPM_UNREACHABLE);

      await expect(upgrade()).rejects.toThrow('Failed to upgrade CLI');

      expect(logger.success).not.toHaveBeenCalled();
    });
  });

  describe('gyo upgrade --check', () => {
    it('should only ask npm, and say how to upgrade', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${released}\n`));

      await upgrade({ check: true });

      expect(mockedExec).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(`Current version: ${installed}`);
      expect(logger.info).toHaveBeenCalledWith(`Latest version:  ${released}`);
      expect(logger.info).toHaveBeenCalledWith(`\nA new version is available: ${released}`);
      expect(logger.info).toHaveBeenCalledWith('Run `gyo upgrade` to update');
    });

    it('should say so when the installed version is the latest', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${installed}\n`));

      await upgrade({ check: true });

      expect(logger.success).toHaveBeenCalledWith('\nYou are already on the latest version!');
      expect(mockedExec).toHaveBeenCalledTimes(1);
    });
  });

  describe('gyo upgrade --version <version>', () => {
    it('should install that version rather than the latest one', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${released}\n`)).mockResolvedValueOnce(npm(''));

      await upgrade({ version: chosen });

      expect(mockedExec).toHaveBeenNthCalledWith(
        2,
        'npm',
        ['install', '-g', `@gyo-framework/cli@${chosen}`],
        { stdio: 'inherit' }
      );
      expect(logger.success).toHaveBeenCalledWith(`\nSuccessfully upgraded to v${chosen}!`);
    });

    it('should say it is up to date when it is the installed version', async () => {
      mockedExec.mockResolvedValueOnce(npm(`${released}\n`));

      await upgrade({ version: installed });

      expect(logger.success).toHaveBeenCalledWith('\nAlready up to date!');
      expect(mockedExec).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the installed version is newer than the one on npm', () => {
    // A local build, or a pre-release that npm does not list as latest.
    it('should install nothing and say it is up to date', async () => {
      mockedExec.mockResolvedValueOnce(npm('0.0.1\n'));

      await upgrade();

      expect(mockedExec).toHaveBeenCalledTimes(1);
      expect(logger.success).toHaveBeenCalledWith('\nAlready up to date!');
    });

    it('should not offer the older version with --check', async () => {
      mockedExec.mockResolvedValueOnce(npm('0.0.1\n'));

      await upgrade({ check: true });

      expect(logger.info).not.toHaveBeenCalledWith('\nA new version is available: 0.0.1');
      expect(logger.success).toHaveBeenCalledWith('\nYou are already on the latest version!');
    });
  });

  describe('when npm cannot say what the latest version is', () => {
    it('should fail with the GyoError as it is, without installing anything', async () => {
      mockedExec.mockResolvedValueOnce(NPM_UNREACHABLE);

      const failing = upgrade();

      await expect(failing).rejects.toThrow('Could not fetch latest version from npm');
      // Not wrapped again by the entry point, which would keep the original as its cause.
      await expect(failing).rejects.toMatchObject({
        name: 'GyoError',
        exitCode: 1,
        cause: undefined,
      });
      expect(mockedExec).toHaveBeenCalledTimes(1);
    });

    it('should report the failure once', async () => {
      mockedExec.mockResolvedValueOnce(NPM_UNREACHABLE);

      await expect(upgrade()).rejects.toThrow('Could not fetch latest version from npm');

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Could not fetch latest version from npm');
    });
  });
});
