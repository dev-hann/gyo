jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
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

import { WebServerService } from '../services/web-server.service';
import { isLoopbackHost, namedHostOf } from '../core/index';
import { executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { connect } from 'net';
import { LOCALHOST, DEFAULT_PORT, WEB_SERVER_TIMEOUT_MS } from '../core/index';
import { EventEmitter } from 'events';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;
const mockedConnect = connect as unknown as jest.MockedFunction<typeof connect>;

interface MockSocket extends EventEmitter {
  destroy: jest.Mock;
}

function createMockSocket(): MockSocket {
  const socket = new EventEmitter() as MockSocket;
  socket.destroy = jest.fn();
  return socket;
}

function createMockProcess(): any {
  const { EventEmitter } = jest.requireActual('events');
  const mockProcess = new EventEmitter();
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.killed = false;
  return mockProcess;
}

function getSpawnedProcess(): any {
  const { spawn } = jest.requireMock('child_process');
  return spawn.mock.results[0].value;
}

/** The pre-check finds nothing listening, so `start` goes on to spawn. */
function mockPortFree(): MockSocket {
  const socket = createMockSocket();
  mockedConnect.mockReturnValueOnce(socket as any);
  return socket;
}

async function refuse(socket: MockSocket): Promise<void> {
  await new Promise((r) => setImmediate(r));
  socket.emit('error', new Error('ECONNREFUSED'));
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
    it('should throw ServerStartError when npm install fails', async () => {
      mockedPathExists.mockResolvedValueOnce(false);
      mockedExec.mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'npm error',
        code: 1,
      });

      await expect(
        service.start({ webPath: '/project/lib', port: 3000, startCommand: 'npm run dev' })
      ).rejects.toThrow('Failed to install web dependencies');
    });

    it('should install node_modules when not found and resolve on port probe', async () => {
      mockedPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mockedExec.mockResolvedValueOnce({
        success: true,
        stdout: 'added 100 packages',
        stderr: '',
        code: 0,
      });

      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const freeSocket = mockPortFree();
      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await refuse(freeSocket);
      await new Promise((r) => setImmediate(r));
      socket.emit('connect');
      const handle = await startPromise;

      expect(mockedExec).toHaveBeenCalledWith('npm', ['install'], expect.any(Object));
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
    });

    it('should reject without spawning when the port is already in use', async () => {
      const { spawn } = jest.requireMock('child_process');
      const takenSocket = createMockSocket();
      mockedConnect.mockReturnValueOnce(takenSocket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await new Promise((r) => setImmediate(r));
      takenSocket.emit('connect');

      await expect(startPromise).rejects.toThrow('already in use');
      expect(spawn).not.toHaveBeenCalled();
      expect(takenSocket.destroy).toHaveBeenCalled();
    });

    it('should advertise the host the profile names rather than looking for one', async () => {
      const { spawn } = jest.requireMock('child_process');
      spawn.mockReturnValue(createMockProcess());

      const freeSocket = mockPortFree();
      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
        advertiseHost: '10.0.0.7',
      });

      await refuse(freeSocket);
      await new Promise((r) => setImmediate(r));
      socket.emit('connect');

      expect((await startPromise).url).toBe('http://10.0.0.7:3000');
    });

    it('should spawn the configured start command as-is without framework detection', async () => {
      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const freeSocket = mockPortFree();
      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startCommand = 'npm run dev -- --host 0.0.0.0';
      const startPromise = service.start({
        webPath: '/project/lib',
        port: 5173,
        startCommand,
      });

      await refuse(freeSocket);
      await new Promise((r) => setImmediate(r));
      socket.emit('connect');
      await startPromise;

      expect(spawn).toHaveBeenCalledWith(startCommand, [], expect.any(Object));
      expect(mockedConnect).toHaveBeenCalledWith({ host: LOCALHOST, port: 5173 });
    });

    it('should remove pre-start cleanup paths when they exist', async () => {
      const { spawn } = jest.requireMock('child_process');
      const { remove } = jest.requireMock('fs-extra');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      mockedPathExists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      const freeSocket = mockPortFree();
      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
        preStartCleanup: ['.next/dev/lock'],
      });

      await refuse(freeSocket);
      await new Promise((r) => setImmediate(r));
      socket.emit('connect');
      await startPromise;

      expect(remove).toHaveBeenCalledWith('/project/lib/.next/dev/lock');
    });

    it('should retry the port probe when connection is refused', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const freeSocket = mockPortFree();
      const refusedSocket = createMockSocket();
      const readySocket = createMockSocket();
      mockedConnect
        .mockReturnValueOnce(refusedSocket as any)
        .mockReturnValueOnce(readySocket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await refuse(freeSocket);
      await refuse(refusedSocket);

      jest.advanceTimersByTime(300);
      await new Promise((r) => setImmediate(r));
      readySocket.emit('connect');

      const handle = await startPromise;

      expect(mockedConnect).toHaveBeenCalledTimes(3);
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
      jest.useRealTimers();
    });

    it('should reject when the server process exits before the port is ready', async () => {
      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const freeSocket = mockPortFree();
      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await refuse(freeSocket);
      await new Promise((r) => setImmediate(r));
      const proc = getSpawnedProcess();
      proc.emit('exit', 1);

      await expect(startPromise).rejects.toThrow('Web server exited with code 1');
      expect(socket.destroy).toHaveBeenCalled();
    });

    it('should stop the server it started when the port never gets ready', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);

      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      mockProcess.pid = 4242;
      spawn.mockReturnValue(mockProcess);

      const freeSocket = mockPortFree();
      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await refuse(freeSocket);
      await new Promise((r) => setImmediate(r));
      jest.advanceTimersByTime(WEB_SERVER_TIMEOUT_MS);

      await expect(startPromise).rejects.toThrow('failed to start within');
      expect(kill).toHaveBeenCalledWith(-4242, 'SIGKILL');

      kill.mockRestore();
      jest.useRealTimers();
    });
  });
});
