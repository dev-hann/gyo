// `start` runs `npm install`, and signals the server's process group when it
// cannot return the server: both would act on this machine.
jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
  signalProcessTree: jest.fn(),
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
  pathExists: jest.fn().mockResolvedValue(true),
  ensureDir: jest.fn(),
  copyDir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  removeDir: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  remove: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('net', () => ({
  connect: jest.fn(),
}));

import { WebServerService, REACHABLE_TIMEOUT_MS } from '../services/web-server.service';
import { isLoopbackHost, namedHostOf } from '../core/index';
import { executeCommand, signalProcessTree } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { connect } from 'net';
import { LOCALHOST, DEFAULT_PORT, WEB_SERVER_TIMEOUT_MS } from '../core/index';
import { EventEmitter } from 'events';
import { fakeChildProcess } from './helpers/process';
import type { FakeChildProcess } from './helpers/process';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedSignalProcessTree = signalProcessTree as jest.MockedFunction<typeof signalProcessTree>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
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

/** Lets the service run until `condition` holds, instead of guessing when it gets there. */
async function until(condition: () => boolean): Promise<void> {
  for (let tries = 0; tries < 200 && !condition(); tries++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
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
    jest.clearAllMocks();
    service = new WebServerService();
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
    const options = { webPath: '/project/lib', port: 3000, startCommand: 'npm run dev' };

    beforeEach(() => {
      // Nothing reaches process.kill while signalProcessTree is mocked: the guard keeps
      // a fake pid from the real one for as long as one is around.
      jest.spyOn(process, 'kill').mockImplementation(() => true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    function expectSpawned(command: string): void {
      const { spawn } = jest.requireMock('child_process');
      expect(spawn).toHaveBeenCalledWith(command, [], {
        cwd: '/project/lib',
        stdio: 'pipe',
        shell: true,
        detached: true,
      });
    }

    it('should throw ServerStartError when npm install fails', async () => {
      mockedPathExists.mockResolvedValueOnce(false);
      mockedExec.mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'npm error',
        code: 1,
      });

      await expect(service.start(options)).rejects.toThrow('Failed to install web dependencies');
    });

    it('should install node_modules when not found and resolve on the port probe', async () => {
      mockedPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
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

      expect(mockedExec).toHaveBeenCalledWith('npm', ['install'], expect.any(Object));
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
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
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
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

    it('should remove pre-start cleanup paths when they exist', async () => {
      const { remove } = jest.requireMock('fs-extra');
      spawnServer();
      mockedPathExists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
      answering('error');
      answering('connect');
      answering('connect');

      await service.start({ ...options, preStartCleanup: ['.next/dev/lock'] });

      expect(remove).toHaveBeenCalledWith('/project/lib/.next/dev/lock');
    });

    it('should retry the port probe when connection is refused', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
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
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
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
