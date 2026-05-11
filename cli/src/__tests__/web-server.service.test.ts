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

import { WebServerService } from '../services/web-server.service';
import { executeCommand } from '../utils/exec';
import { pathExists } from '../utils/fs';
import { LOCALHOST, DEFAULT_PORT } from '../core/index';

const mockedExec = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockedPathExists = pathExists as jest.MockedFunction<typeof pathExists>;

describe('WebServerService', () => {
  let service: WebServerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebServerService();
  });

  describe('extractServerUrl', () => {
    it('should extract URL from Next.js local output', () => {
      const output = '  Local:        http://0.0.0.0:3000';
      expect(service.extractServerUrl(output)).toBe(`http://${LOCALHOST}:3000`);
    });

    it('should extract URL from Next.js localhost output', () => {
      const output = '  Local:   http://localhost:3000';
      expect(service.extractServerUrl(output)).toBe(`http://${LOCALHOST}:3000`);
    });

    it('should extract URL from "started server on" output', () => {
      const output = 'started server on 0.0.0.0:8080';
      expect(service.extractServerUrl(output)).toBe(`http://${LOCALHOST}:8080`);
    });

    it('should extract URL from Vite Local output', () => {
      const output = '  Local:   http://localhost:5173/';
      expect(service.extractServerUrl(output)).toBe('http://localhost:5173');
    });

    it('should extract URL from generic http://localhost output', () => {
      const output = 'Server ready at http://localhost:4200';
      expect(service.extractServerUrl(output)).toBe(`http://${LOCALHOST}:4200`);
    });

    it('should extract URL from generic http://0.0.0.0 output', () => {
      const output = 'Listening on http://0.0.0.0:9000';
      expect(service.extractServerUrl(output)).toBe(`http://${LOCALHOST}:9000`);
    });

    it('should extract URL from https output', () => {
      const output = 'Server at https://localhost:443';
      expect(service.extractServerUrl(output)).toBe(`http://${LOCALHOST}:443`);
    });

    it('should return null when no URL pattern matches', () => {
      expect(service.extractServerUrl('no url here')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(service.extractServerUrl('')).toBeNull();
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

    it('should install node_modules when not found', async () => {
      mockedPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mockedExec.mockResolvedValueOnce({
        success: true,
        stdout: 'added 100 packages',
        stderr: '',
        code: 0,
      });

      const { EventEmitter } = jest.requireActual('events');
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.killed = false;

      const { spawn } = jest.requireMock('child_process');
      spawn.mockReturnValue(mockProcess);

      const startPromise = service.start({
        webPath: '/project/lib',
        port: 3000,
        startCommand: 'npm run dev',
      });

      await new Promise((r) => setImmediate(r));
      mockProcess.stdout.emit('data', Buffer.from('  Local:   http://localhost:3000\n'));
      const handle = await startPromise;

      expect(mockedExec).toHaveBeenCalledWith('npm', ['install'], expect.any(Object));
      expect(handle.url).toMatch(/^http:\/\/.+:\d+$/);
    });
  });
});
