// `start` runs `npm install`, and signals the server's process group when it
// cannot return the server: both would act on this machine. What it finds
// installed, and what it removes, are real paths in a temporary directory.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  signalProcessTree: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('net', () => ({
  connect: jest.fn(),
}));

import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import { connect } from 'net';
import {
  DEFAULT_PORT,
  LOCALHOST,
  WEB_SERVER_TIMEOUT_MS,
  isLoopbackHost,
  namedHostOf,
  ServerStartError,
} from '../core/index';
import { WebServerService, REACHABLE_TIMEOUT_MS } from '../services/web-server.service';
import { executeCommand, signalProcessTree } from '../utils/exec';
import { logger } from '../utils/logger';
import { silenceLogger } from './helpers/logger';
import { fakeChildProcess } from './helpers/process';
import type { FakeChildProcess } from './helpers/process';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedSignalProcessTree = signalProcessTree as jest.MockedFunction<typeof signalProcessTree>;
const mockedConnect = jest.mocked(connect);

interface MockSocket extends EventEmitter {
  destroy: jest.Mock;
}

function createMockSocket(): MockSocket {
  const socket = new EventEmitter() as MockSocket;
  socket.destroy = jest.fn();
  return socket;
}

/**
 * A socket that answers by itself once the service listens for it, so that
 * a test never has to guess when the service gets around to it.
 */
function answering(answer: 'connect' | 'error'): MockSocket {
  const socket = createMockSocket();
  const once = socket.once.bind(socket);
  socket.once = ((event: string, listener: () => void) => {
    once(event, listener);
    if (event === answer) {
      setImmediate(() => {
        if (answer === 'error') {
          socket.emit('error', new Error('ECONNREFUSED'));
        } else {
          socket.emit('connect');
        }
      });
    }
    return socket;
  }) as MockSocket['once'];
  mockedConnect.mockReturnValueOnce(socket as any);
  return socket;
}

/** A socket nothing is listening on. */
function silent(): MockSocket {
  const socket = createMockSocket();
  mockedConnect.mockReturnValueOnce(socket as any);
  return socket;
}

/**
 * Lets the service run until `condition` holds, instead of guessing when it
 * gets there. Bounded by time, not by turns: the service looks at real files
 * before its first socket, which takes as long as the disk takes.
 */
async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('The service did not get there within a second');
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** Fakes the timers the service arms; what waits for it still runs on real ones and the real clock. */
function fakeServiceTimers(): void {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'Date'] });
}

/** The dev server, once `start` has spawned it. */
function spawnServer(): FakeChildProcess {
  const { spawn } = jest.requireMock('child_process');
  const server = fakeChildProcess();
  spawn.mockReturnValue(server);
  return server;
}

describe('WebServerService', () => {
  let service: WebServerService;

  beforeEach(() => {
    // Reset, not clear: the answers queued for the next sockets must not outlive the test that queued them.
    jest.resetAllMocks();
    silenceLogger();
    service = new WebServerService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('namedHostOf', () => {
    it('should name the machine a URL points at', () => {
      expect(namedHostOf('http://192.168.0.7:3000')).toBe('192.168.0.7');
      expect(namedHostOf('https://example.com/app')).toBe('example.com');
    });

    it('should treat a loopback host as this machine, and no host as nothing', () => {
      expect(namedHostOf('http://localhost:3000')).toBeUndefined();
      expect(namedHostOf('http://127.0.0.1:3000')).toBeUndefined();
      expect(namedHostOf('not a url')).toBeUndefined();
    });

    it('should tell a loopback host apart', () => {
      expect(isLoopbackHost('localhost')).toBe(true);
      expect(isLoopbackHost('::1')).toBe(true);
      expect(isLoopbackHost('example.com')).toBe(false);
    });
  });

  describe('getLocalIP', () => {
    it('should return a non-empty string', async () => {
      const ip = await service.getLocalIP();

      expect(typeof ip).toBe('string');
      expect(ip.length).toBeGreaterThan(0);
    });
  });

  describe('resolveServerUrl', () => {
    it('should resolve with local IP and port', async () => {
      const url = await service.resolveServerUrl('http://localhost:3000');

      expect(url).toMatch(/^http:\/\/.+:\d+$/);
      expect(url).toContain(':3000');
    });

    it('should use default port when URL has no explicit port', async () => {
      const url = await service.resolveServerUrl('http://localhost');

      expect(url).toContain(`:${DEFAULT_PORT}`);
    });

    it('should use explicit port from URL', async () => {
      const url = await service.resolveServerUrl('http://localhost:8080');

      expect(url).toContain(':8080');
    });
  });

  describe('start', () => {
    let project: string;
    let webPath: string;
    let options: { webPath: string; port: number; startCommand: string };

    beforeEach(() => {
      project = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-web-server-'));
      webPath = path.join(project, 'lib');
      // The dependencies are installed, as after the first run.
      fs.ensureDirSync(path.join(webPath, 'node_modules'));
      options = { webPath, port: 3000, startCommand: 'npm run dev' };

      // Nothing reaches process.kill while signalProcessTree is mocked: the guard keeps
      // a fake pid from the real one for as long as one is around.
      jest.spyOn(process, 'kill').mockImplementation(() => true);
    });

    afterEach(() => {
      jest.useRealTimers();
      fs.removeSync(project);
    });

    /** The web app was never installed: the dependencies have to be put in before the server. */
    const withoutDependencies = (): void => {
      fs.removeSync(path.join(webPath, 'node_modules'));
    };

    function expectSpawned(command: string): void {
      const { spawn } = jest.requireMock('child_process');
      expect(spawn).toHaveBeenCalledWith(command, [], {
        cwd: webPath,
        stdio: ['ignore', 'ignore', 'pipe'],
        shell: true,
        detached: true,
      });
    }

    it('should throw ServerStartError when npm install fails', async () => {
      withoutDependencies();
      mockedExec.mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'npm error',
        code: 1,
      });

      const failing = service.start(options);

      await expect(failing).rejects.toThrow('Failed to install web dependencies');
      await expect(failing).rejects.toBeInstanceOf(ServerStartError);
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install'], {
        cwd: webPath,
        stdio: 'inherit',
      });
    });

    it('should install node_modules when not found and resolve on the port probe', async () => {
      withoutDependencies();
      mockedExec.mockResolvedValueOnce({
        success: true,
        stdout: 'added 100 packages',
        stderr: '',
        code: 0,
      });
      spawnServer();
      answering('error');
      answering('connect');
      answering('connect');

      const handle = await service.start(options);

      expect(mockedExec).toHaveBeenCalledWith('npm', ['install'], {
        cwd: webPath,
        stdio: 'inherit',
      });
      expect(logger.info).toHaveBeenCalledWith(
        'node_modules not found. Installing dependencies (this may take a minute)...'
      );
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
    });

    it('should leave the dependencies alone when node_modules is there', async () => {
      spawnServer();
      answering('error');
      answering('connect');
      answering('connect');

      await service.start(options);

      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should reject without spawning when the port is already in use', async () => {
      const { spawn } = jest.requireMock('child_process');
      const taken = answering('connect');

      await expect(service.start(options)).rejects.toThrow('already in use');

      expect(spawn).not.toHaveBeenCalled();
      expect(taken.destroy).toHaveBeenCalled();
    });

    it('should advertise the host the profile names rather than looking for one', async () => {
      spawnServer();
      answering('error');
      answering('connect');
      answering('connect');

      const handle = await service.start({ ...options, advertiseHost: '10.0.0.7' });

      expect(handle.url).toBe('http://10.0.0.7:3000');
    });

    it('should not look further when the device is told to use this machine', async () => {
      spawnServer();
      answering('error');
      answering('connect');

      const handle = await service.start({ ...options, advertiseHost: '127.0.0.1' });

      expect(handle.url).toBe('http://127.0.0.1:3000');
      expect(mockedConnect).toHaveBeenCalledTimes(2);
    });

    it('should refuse a server that answers on localhost but not where the device looks', async () => {
      const server = spawnServer();
      answering('error');
      answering('connect');
      // The device's end refuses the connection outright.
      answering('error');

      await expect(service.start({ ...options, advertiseHost: '10.0.0.7' })).rejects.toThrow(
        'it does not answer at http://10.0.0.7:3000, where the device will look for it'
      );
      expect(mockedSignalProcessTree).toHaveBeenCalledWith(server, 'SIGKILL');
    });

    it("should give up when the device's address never answers", async () => {
      fakeServiceTimers();
      const server = spawnServer();
      answering('error');
      answering('connect');
      const deviceEnd = silent();

      const startPromise = service.start({ ...options, advertiseHost: '10.0.0.7' });
      await until(() => deviceEnd.listenerCount('connect') > 0);
      jest.advanceTimersByTime(REACHABLE_TIMEOUT_MS);

      await expect(startPromise).rejects.toThrow('where the device will look for it');
      expect(mockedSignalProcessTree).toHaveBeenCalledWith(server, 'SIGKILL');
    });

    it('should spawn the configured start command as-is without framework detection', async () => {
      spawnServer();
      answering('error');
      answering('connect');
      answering('connect');

      const startCommand = 'npm run dev -- --host 0.0.0.0';
      await service.start({ ...options, port: 5173, startCommand });

      expectSpawned(startCommand);
      expect(mockedConnect).toHaveBeenCalledWith({ host: LOCALHOST, port: 5173 });
    });

    it('should remove the pre-start cleanup paths that are there, and skip the rest', async () => {
      const lock = path.join(webPath, '.next', 'dev', 'lock');
      const cache = path.join(webPath, '.vite');
      fs.outputFileSync(lock, '');
      fs.outputFileSync(path.join(cache, 'deps.json'), '');
      spawnServer();
      answering('error');
      answering('connect');
      answering('connect');

      await service.start({ ...options, preStartCleanup: ['.next/dev/lock', '.vite', 'dist'] });

      expect(fs.pathExistsSync(lock)).toBe(false);
      expect(fs.pathExistsSync(cache)).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should start anyway when a cleanup path cannot be removed, and say so', async () => {
      const dev = path.join(webPath, '.next', 'dev');
      const lock = path.join(dev, 'lock');
      fs.outputFileSync(lock, '');
      // Read-only parent makes removing what is inside it fail.
      fs.chmodSync(dev, 0o500);
      spawnServer();
      answering('error');
      answering('connect');
      answering('connect');

      try {
        const handle = await service.start({ ...options, preStartCleanup: ['.next/dev/lock'] });

        expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
        expect(fs.pathExistsSync(lock)).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/^Could not remove \.next\/dev\/lock: /)
        );
      } finally {
        fs.chmodSync(dev, 0o700);
      }
    });

    it('should retry the port probe when connection is refused', async () => {
      fakeServiceTimers();
      spawnServer();
      answering('error');
      const refused = answering('error');
      answering('connect');
      answering('connect');

      const startPromise = service.start(options);
      await until(() => refused.listenerCount('error') > 0);
      await until(() => refused.listenerCount('error') === 0);
      jest.advanceTimersByTime(300);

      const handle = await startPromise;

      expect(mockedConnect).toHaveBeenCalledTimes(4);
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
    });

    it('should reject when the server process exits before the port is ready', async () => {
      const server = spawnServer();
      answering('error');
      const probe = silent();

      const startPromise = service.start(options);
      await until(() => probe.listenerCount('error') > 0);
      server.emit('exit', 1);

      await expect(startPromise).rejects.toThrow('Web server exited with code 1');
      expect(probe.destroy).toHaveBeenCalled();
    });

    it('should stop the server it started when the port never gets ready', async () => {
      fakeServiceTimers();
      const server = spawnServer();
      answering('error');
      const probe = silent();

      const startPromise = service.start(options);
      await until(() => probe.listenerCount('error') > 0);
      jest.advanceTimersByTime(WEB_SERVER_TIMEOUT_MS);

      await expect(startPromise).rejects.toThrow('failed to start within');
      expect(mockedSignalProcessTree).toHaveBeenCalledWith(server, 'SIGKILL');
    });
  });
});
