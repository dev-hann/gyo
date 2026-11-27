// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot
// run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

// ESM-only, and it would open a browser.
jest.mock('open', () => ({ __esModule: true, default: jest.fn() }));

// A guard: should `gyo debug` come to run a device tool, it must not reach one from a test.
jest.mock('../utils/exec', () => ({ executeCommand: jest.fn() }));

jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import open from 'open';
import { DebugCommand } from '../commands/debug';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

const mockedOpen = jest.mocked(open);

/** `gyo debug <platform>`: Commander hands the platform over as the argument. */
function debug(...args: string[]): Promise<void> {
  const command = new DebugCommand();
  command.setPositionalArgs(args);
  command.setOptions({});
  return command.execute();
}

describe('DebugCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMeta', () => {
    it('should name the command, its argument and what it launches', () => {
      expect(new DebugCommand().getMeta()).toEqual({
        name: 'debug',
        arguments: '<platform>',
        description: 'Launch debugger for the specified platform',
      });
    });
  });

  describe('outside a project', () => {
    let outside: string;
    let previousCwd: string;

    beforeEach(() => {
      previousCwd = process.cwd();
      outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-outside-'));
      process.chdir(outside);
    });

    afterEach(() => {
      process.chdir(previousCwd);
      fs.removeSync(outside);
    });

    it('should refuse, and say how to get a project', async () => {
      await expect(debug('android')).rejects.toThrow(
        `Not a gyo project (gyo.config.json not found in ${outside}).\n` +
          "  Run 'gyo create <project-name>' to create a new project."
      );

      expect(mockedOpen).not.toHaveBeenCalled();
    });
  });

  describe('in a project', () => {
    let project: TestProject;

    beforeEach(async () => {
      project = await createTestProject();
    });

    afterEach(() => {
      project.remove();
    });

    describe('gyo debug android', () => {
      it('should open chrome://inspect and say how to inspect the app', async () => {
        await debug('android');

        expect(mockedOpen).toHaveBeenCalledTimes(1);
        expect(mockedOpen).toHaveBeenCalledWith('chrome://inspect');
        expect(logger.info).toHaveBeenCalledWith(
          'Opening Chrome DevTools for Android debugging...\n'
        );
        expect(logger.info).toHaveBeenCalledWith('  3. Run your app with `gyo run`');
        expect(logger.success).toHaveBeenCalledWith('\n✓ Chrome DevTools opened!');
        expect(logger.warn).not.toHaveBeenCalled();
      });

      it('should say where to go when Chrome cannot be opened', async () => {
        mockedOpen.mockRejectedValueOnce(new Error('no browser'));

        await debug('android');

        expect(logger.warn).toHaveBeenCalledWith(
          '\nCould not auto-open Chrome. Please manually navigate to:'
        );
        expect(logger.info).toHaveBeenCalledWith('  chrome://inspect');
        expect(logger.success).not.toHaveBeenCalled();
      });
    });

    describe('gyo debug ios', () => {
      it('should say how to open Safari Web Inspector, and open nothing', async () => {
        await debug('ios');

        expect(logger.info).toHaveBeenCalledWith('iOS Debugging with Safari Web Inspector\n');
        expect(logger.info).toHaveBeenCalledWith('  3. Open Safari on your Mac');
        expect(mockedOpen).not.toHaveBeenCalled();
      });
    });

    it('should refuse a platform it cannot debug, naming the ones it can', async () => {
      await expect(debug('windows')).rejects.toThrow(
        'Invalid platform: windows. Valid platforms are: android, ios'
      );

      expect(mockedOpen).not.toHaveBeenCalled();
    });

    it('should refuse a platform the project has disabled', async () => {
      await project.setConfig({ platforms: { android: { enabled: false } } });

      await expect(debug('android')).rejects.toThrow(
        "Platform 'android' is disabled in gyo.config.json. " +
          'Enable it: gyo config set platforms.android.enabled true'
      );

      expect(mockedOpen).not.toHaveBeenCalled();
    });
  });
});
