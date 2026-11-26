jest.mock('../utils/exec', () => ({
  executeCommand: jest.fn(),
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
  getTemplatesPath: jest.fn(),
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
import { executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { connect } from 'net';
import { LOCALHOST, DEFAULT_PORT } from '../core/index';
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

describe('WebServerService', () => {
  let service: WebServerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebServerService();
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

      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await new Promise((r) => setImmediate(r));
      socket.emit('connect');
      const handle = await startPromise;

      expect(mockedExec).toHaveBeenCalledWith('npm', ['install'], expect.any(Object));
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
    });

    it('should spawn the configured start command as-is without framework detection', async () => {
      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startCommand = 'npm run dev -- --host 0.0.0.0';
      const startPromise = service.start({
        webPath: '/project/lib',
        port: 5173,
        startCommand,
      });

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

      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
        preStartCleanup: ['.next/dev/lock'],
      });

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

      await new Promise((r) => setImmediate(r));
      refusedSocket.emit('error', new Error('ECONNREFUSED'));

      jest.advanceTimersByTime(300);
      await new Promise((r) => setImmediate(r));
      readySocket.emit('connect');

      const handle = await startPromise;

      expect(mockedConnect).toHaveBeenCalledTimes(2);
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
      jest.useRealTimers();
    });

    it('should reject when the server process exits before the port is ready', async () => {
      const { spawn } = jest.requireMock('child_process');
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const socket = createMockSocket();
      mockedConnect.mockReturnValueOnce(socket as any);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await new Promise((r) => setImmediate(r));
      const proc = getSpawnedProcess();
      proc.emit('exit', 1);

      await expect(startPromise).rejects.toThrow('Web server exited with code 1');
      expect(socket.destroy).toHaveBeenCalled();
    });
  });
});
