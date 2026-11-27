jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  getGradlew: jest.fn().mockReturnValue('./gradlew'),
  checkCommandExists: jest.fn(),
  signalProcessTree: jest.requireActual('../utils/exec').signalProcessTree,
}));

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
  pathExists: jest.fn().mockResolvedValue(false),
  ensureDir: jest.fn(),
  copyDir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  removeDir: jest.fn(),
}));

jest.mock('../services/config.service', () => ({
  loadConfig: jest.fn().mockResolvedValue(null),
  validateConfig: jest.fn(),
  saveConfig: jest.fn().mockResolvedValue(undefined),
  shouldStartLocalServer: jest.fn(),
}));

// One `start` for every instance, so that a test can read what was asked of it.
jest.mock('../services/web-server.service', () => {
  const start = jest.fn().mockResolvedValue({ process: null, url: 'http://192.168.0.7:3000' });
  return { WebServerService: jest.fn().mockImplementation(() => ({ start })) };
});

import { AbstractRunCommand } from '../commands/run/AbstractRunCommand';
import type { CommandMeta } from '../commands/base/BaseCommand';
import { DEFAULT_PORT, PARENT_WATCH_INTERVAL_MS, PROCESS_KILL_TIMEOUT_MS } from '../core/index';

class TestableRunCommand extends AbstractRunCommand {
  getMeta(): CommandMeta {
    return { name: 'test-run', description: 'test' };
  }

  public testGetPortFromProfile(profile: string): number {
    return this.getPortFromProfile(profile);
  }

  public testGetStartCommand(): string {
    return this.getStartCommand();
  }

  protected runPlatform(): Promise<void> {
    return Promise.resolve();
  }

  protected monitorLogs(): Promise<void> {
    return Promise.resolve();
  }
}

describe('AbstractRunCommand', () => {
  let command: TestableRunCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestableRunCommand();
    (command as any).options = { profile: 'development' };
  });

  afterEach(() => {
    (command as any).platformProcess = null;
    (command as any).isCleaningUp = false;
  });

  describe('getStartCommand', () => {
    it('should return configured start command', () => {
      (command as any).config = {
        script: { start: 'npm run dev' },
      };

      expect(command.testGetStartCommand()).toBe('npm run dev');
    });

    it('should trim whitespace from command', () => {
      (command as any).config = {
        script: { start: '  npm run dev  ' },
      };

      expect(command.testGetStartCommand()).toBe('npm run dev');
    });

    it('should throw when start command is not configured', () => {
      (command as any).config = {};

      expect(() => command.testGetStartCommand()).toThrow('Start command is not configured');
    });

    it('should throw when start command is empty string', () => {
      (command as any).config = { script: { start: '   ' } };

      expect(() => command.testGetStartCommand()).toThrow('Start command is not configured');
    });
  });

  describe('getPortFromProfile', () => {
    it('should return default port when profile not found', () => {
      (command as any).config = { profiles: {} };

      expect(command.testGetPortFromProfile('production')).toBe(DEFAULT_PORT);
    });

    it('should return default port when config has no profiles', () => {
      (command as any).config = {};

      expect(command.testGetPortFromProfile('development')).toBe(DEFAULT_PORT);
    });

    it('should extract port from profile serverUrl', () => {
      (command as any).config = {
        profiles: {
          development: { serverUrl: 'http://localhost:8080' },
        },
      };

      expect(command.testGetPortFromProfile('development')).toBe(8080);
    });

    it('should return default port when URL has no explicit port', () => {
      (command as any).config = {
        profiles: {
          production: { serverUrl: 'https://example.com' },
        },
      };

      expect(command.testGetPortFromProfile('production')).toBe(DEFAULT_PORT);
    });

    it('should return default port for invalid URL', () => {
      (command as any).config = {
        profiles: {
          development: { serverUrl: 'not-a-url' },
        },
      };

      expect(command.testGetPortFromProfile('development')).toBe(DEFAULT_PORT);
    });
  });

  describe('startWebServer', () => {
    const startOf = (): jest.Mock => {
      const { WebServerService } = jest.requireMock('../services/web-server.service');
      return new WebServerService().start as jest.Mock;
    };

    it('should leave the address to this machine when the profile says localhost', async () => {
      (command as any).config = {
        script: { start: 'npm run dev' },
        profiles: { development: { serverUrl: 'http://localhost:3000' } },
      };

      await command['startWebServer']('/project/lib', 3000);

      expect(startOf()).toHaveBeenCalledWith(
        expect.objectContaining({ advertiseHost: undefined, port: 3000 })
      );
    });

    it('should advertise the machine the profile names', async () => {
      (command as any).config = {
        script: { start: 'npm run dev' },
        profiles: { development: { serverUrl: 'http://192.168.0.7:3000' } },
      };

      await command['startWebServer']('/project/lib', 3000);

      expect(startOf()).toHaveBeenCalledWith(
        expect.objectContaining({ advertiseHost: '192.168.0.7' })
      );
    });
  });

  describe('validateLibDirectory', () => {
    it('should throw ServerStartError when lib/ directory not found', async () => {
      (command as any).config = { name: 'test', version: '1.0.0', platforms: {} };

      const { pathExists } = jest.requireMock('../utils/fs');
      pathExists.mockResolvedValue(false);

      await expect((command as any)['validateLibDirectory']('/project/lib')).rejects.toThrow(
        "'lib/' directory not found"
      );
    });

    it('should throw ServerStartError when lib/package.json not found', async () => {
      (command as any).config = { name: 'test', version: '1.0.0', platforms: {} };

      const { pathExists } = jest.requireMock('../utils/fs');
      pathExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await expect((command as any)['validateLibDirectory']('/project/lib')).rejects.toThrow(
        "'lib/package.json' not found"
      );
    });

    it('should not throw when lib/ and package.json exist', async () => {
      (command as any).config = { name: 'test', version: '1.0.0', platforms: {} };

      const { pathExists } = jest.requireMock('../utils/fs');
      pathExists.mockResolvedValue(true);

      await expect(
        (command as any)['validateLibDirectory']('/project/lib')
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanupPlatformOnly', () => {
    it('should kill platform process when it exists and is not killed', () => {
      const mockKill = jest.fn();
      const mockProcess = {
        killed: false,
        pid: 12345,
        kill: mockKill,
      };
      (command as any).platformProcess = mockProcess;

      (command as any)['cleanupPlatformOnly']();

      expect(mockKill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should not attempt kill when platform process is null', () => {
      (command as any).platformProcess = null;

      expect(() => (command as any)['cleanupPlatformOnly']()).not.toThrow();
    });

    it('should not attempt kill when platform process is already killed', () => {
      const mockKill = jest.fn();
      const mockProcess = {
        killed: true,
        pid: 12345,
        kill: mockKill,
      };
      (command as any).platformProcess = mockProcess;

      (command as any)['cleanupPlatformOnly']();

      expect(mockKill).not.toHaveBeenCalled();
    });

    it('should ignore errors during kill', () => {
      const mockKill = jest.fn(() => {
        throw new Error('EPERM');
      });
      const mockProcess = {
        killed: false,
        pid: 12345,
        kill: mockKill,
      };
      (command as any).platformProcess = mockProcess;

      expect(() => (command as any)['cleanupPlatformOnly']()).not.toThrow();
    });

    it('should not kill when pid is undefined', () => {
      const mockKill = jest.fn();
      const mockProcess = {
        killed: false,
        pid: undefined,
        kill: mockKill,
      };
      (command as any).platformProcess = mockProcess;

      (command as any)['cleanupPlatformOnly']();

      expect(mockKill).not.toHaveBeenCalled();
    });
  });

  describe('setupSignalHandlers', () => {
    let handlers: Record<string, () => void>;

    beforeEach(() => {
      handlers = {};
      jest.spyOn(process, 'on').mockImplementation(((event: string, listener: () => void) => {
        handlers[event] = listener;
        return process;
      }) as typeof process.on);
      jest.spyOn(process, 'kill').mockImplementation(() => true);
      command['setupSignalHandlers']();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should clean up on exit, which also covers crashes', () => {
      expect(handlers.exit).toBeDefined();
      expect(handlers.SIGINT).toBeDefined();
      expect(handlers.SIGTERM).toBeDefined();

      (command as any).webServerProcess = { pid: 1001, killed: false, kill: jest.fn() };
      (command as any).platformProcess = { pid: 1002, killed: false, kill: jest.fn() };

      handlers.exit();

      expect(process.kill).toHaveBeenCalledWith(-1001, 'SIGKILL');
      expect(process.kill).toHaveBeenCalledWith(-1002, 'SIGKILL');
    });

    it('should clean up on every signal that ends the CLI', () => {
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      (command as any).webServerProcess = { pid: 1001, killed: false, kill: jest.fn() };

      // SIGHUP is a closed terminal, SIGQUIT is Ctrl+\: neither runs the
      // 'exit' handler, and the detached dev server would outlive the CLI.
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']) {
        (command as any).isCleaningUp = false;
        (process.kill as jest.Mock).mockClear();

        handlers[signal]?.();

        expect(process.kill).toHaveBeenCalledWith(-1001, 'SIGKILL');
        expect(exit).toHaveBeenCalledWith(0);
      }
    });

    it('should fall back to the process itself when it leads no process group', () => {
      (process.kill as jest.Mock).mockImplementation(() => {
        throw new Error('ESRCH');
      });
      const kill = jest.fn();
      (command as any).platformProcess = { pid: 1002, killed: false, kill };

      handlers.exit();

      expect(kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('launcher watch', () => {
    let exit: jest.SpyInstance;

    /** `process.kill(pid, 0)` answers for the launcher: alive, or gone. */
    function launcherState(state: 'alive' | 'gone'): void {
      (process.kill as jest.Mock).mockImplementation((_pid: number, signal?: number | string) => {
        if (signal === 0 && state === 'gone') {
          throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
        }
        return true;
      });
    }

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on);
      jest.spyOn(process, 'kill').mockImplementation(() => true);
      exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      command['setupSignalHandlers']();
      (command as any).webServerProcess = { pid: 1001, killed: false, kill: jest.fn() };
    });

    afterEach(() => {
      clearInterval((command as any).parentWatch);
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should keep running while the launcher is alive', () => {
      launcherState('alive');
      jest.advanceTimersByTime(PARENT_WATCH_INTERVAL_MS * 3);

      expect(exit).not.toHaveBeenCalled();
      expect(process.kill).not.toHaveBeenCalledWith(-1001, 'SIGKILL');
    });

    it('should shut down once the launcher is gone', () => {
      launcherState('gone');
      jest.advanceTimersByTime(PARENT_WATCH_INTERVAL_MS);

      expect(process.kill).toHaveBeenCalledWith(process.ppid, 0);
      expect(process.kill).toHaveBeenCalledWith(-1001, 'SIGKILL');
      expect(exit).toHaveBeenCalledWith(0);
    });

    it('should check the launcher often enough to matter', () => {
      expect(PARENT_WATCH_INTERVAL_MS).toBeLessThanOrEqual(1000);
    });
  });

  describe('killProcessWithTimeout', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should terminate the whole process group, then kill it when it ignores the signal', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.spyOn(process, 'kill').mockImplementation(() => true);
      const { EventEmitter } = jest.requireActual('events');
      const proc = new EventEmitter() as any;
      proc.pid = 1001;
      proc.killed = false;
      proc.kill = jest.fn();

      const promise = (command as any)['killProcessWithTimeout'](proc);
      await Promise.resolve();

      expect(process.kill).toHaveBeenCalledWith(-1001, 'SIGTERM');

      jest.advanceTimersByTime(PROCESS_KILL_TIMEOUT_MS);
      await promise;

      expect(process.kill).toHaveBeenCalledWith(-1001, 'SIGKILL');
      jest.useRealTimers();
    });
  });

  describe('showSuccessMessage', () => {
    it('should log success message with server URL', () => {
      const { logger } = jest.requireMock('../utils/logger');

      (command as any)['showSuccessMessage']('http://192.168.1.5:3000');

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('http://192.168.1.5:3000')
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Ctrl+C'));
    });
  });

  describe('getValidPlatforms', () => {
    it('should return android and ios', () => {
      expect((command as any)['getValidPlatforms']()).toEqual(['android', 'ios']);
    });
  });

  describe('handleError', () => {
    it('should wrap non-GyoError in GyoError with cause', async () => {
      (command as any).failSpinner = jest.fn();
      (command as any).cleanup = jest.fn().mockResolvedValue(undefined);

      const error = new Error('something broke');

      await expect((command as any)['handleError'](error)).rejects.toThrow('something broke');
    });

    it('should re-throw GyoError as-is', async () => {
      const { GyoError } = jest.requireActual('../core/errors');
      (command as any).failSpinner = jest.fn();
      (command as any).cleanup = jest.fn().mockResolvedValue(undefined);

      const error = new GyoError('gyo fail', 2);
      let thrown: unknown;
      try {
        await (command as any)['handleError'](error);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBe(error);
    });

    it('should log debug stack when error has stack', async () => {
      const { logger } = jest.requireMock('../utils/logger');
      (command as any).failSpinner = jest.fn();
      (command as any).cleanup = jest.fn().mockResolvedValue(undefined);

      const error = new Error('stack-test');
      error.stack = 'Error: stack-test\n    at test.js:1:1';

      try {
        await (command as any)['handleError'](error);
      } catch {
        /* expected rethrow */
      }

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('stack-test'));
    });

    it('should handle non-Error values', async () => {
      (command as any).failSpinner = jest.fn();
      (command as any).cleanup = jest.fn().mockResolvedValue(undefined);

      await expect((command as any)['handleError']('string error')).rejects.toThrow('string error');
    });

    it('should stop the dev server before reporting the error', async () => {
      const { logger } = jest.requireMock('../utils/logger');
      const order: string[] = [];
      (command as any).cleanup = jest.fn().mockImplementation(async () => {
        order.push('cleanup');
      });
      logger.error.mockImplementation(() => {
        order.push('report');
      });

      await (command as any)['handleError'](new Error('x')).catch(() => undefined);

      expect(order).toEqual(['cleanup', 'report']);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
