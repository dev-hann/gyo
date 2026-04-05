import { executeCommand, checkCommandExists, getGradlew } from '../utils/exec';

jest.mock('child_process', () => {
  const { EventEmitter } = jest.requireActual('events');

  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    return proc;
  }

  return {
    spawn: jest.fn(),
    __createMockProcess: createMockProcess,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const childProcessMod = require('child_process');
const mockSpawn = childProcessMod.spawn as jest.Mock;
const createMockProc: () => any = childProcessMod.__createMockProcess;

function createMockProcess() {
  return createMockProc();
}

describe('exec utils', () => {
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);
  });

  describe('getGradlew', () => {
    it('should return gradlew.bat on win32', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(getGradlew()).toBe('gradlew.bat');
      Object.defineProperty(process, 'platform', { value: original });
    });

    it('should return ./gradlew on non-win32', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(getGradlew()).toBe('./gradlew');
      Object.defineProperty(process, 'platform', { value: original });
    });
  });

  describe('executeCommand', () => {
    it('should spawn with shell:true and combined command', async () => {
      const promise = executeCommand('echo', ['hello']);

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn.mock.calls[0][0]).toBe('echo hello');
      expect(mockSpawn.mock.calls[0][2].shell).toBe(true);

      mockProcess.stdout.emit('data', Buffer.from('hello\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('hello');
      expect(result.code).toBe(0);
    });

    it('should handle command without args', async () => {
      const promise = executeCommand('echo');

      expect(mockSpawn.mock.calls[0][0]).toBe('echo');

      mockProcess.stdout.emit('data', Buffer.from('\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('should return success:false on non-zero exit code', async () => {
      const promise = executeCommand('false');

      mockProcess.stderr.emit('data', Buffer.from('error msg'));
      mockProcess.emit('close', 1);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('error msg');
      expect(result.code).toBe(1);
    });

    it('should handle spawn error', async () => {
      const promise = executeCommand('nonexistent');

      mockProcess.emit('error', new Error('spawn error'));

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('spawn error');
      expect(result.code).toBeNull();
    });

    it('should capture both stdout and stderr', async () => {
      const promise = executeCommand('cmd');

      mockProcess.stdout.emit('data', Buffer.from('out'));
      mockProcess.stderr.emit('data', Buffer.from('err'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err');
    });

    it('should trim whitespace from output', async () => {
      const promise = executeCommand('echo');

      mockProcess.stdout.emit('data', Buffer.from('  hello  \n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.stdout).toBe('hello');
    });

    it('should pass spawn options', async () => {
      const promise = executeCommand('echo', ['test'], { cwd: '/tmp' });

      expect(mockSpawn.mock.calls[0][2].cwd).toBe('/tmp');

      mockProcess.emit('close', 0);
      await promise;
    });

    it('should write stdout to process.stdout when stdio is inherit', async () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const promise = executeCommand('echo', ['hello'], { stdio: 'inherit' });

      mockProcess.stdout.emit('data', Buffer.from('hello\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(writeSpy).toHaveBeenCalledWith('hello\n');
      expect(result.stdout).toBe('hello');

      writeSpy.mockRestore();
    });

    it('should write stderr to process.stderr when stdio is inherit', async () => {
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation();

      const promise = executeCommand('cmd', [], { stdio: 'inherit' });

      mockProcess.stderr.emit('data', Buffer.from('err\n'));
      mockProcess.emit('close', 1);

      const result = await promise;
      expect(writeSpy).toHaveBeenCalledWith('err\n');
      expect(result.stderr).toBe('err');

      writeSpy.mockRestore();
    });

    it('should not write stdout to process.stdout when stdio is pipe', async () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const promise = executeCommand('echo', ['hello'], { stdio: 'pipe' });

      mockProcess.stdout.emit('data', Buffer.from('hello\n'));
      mockProcess.emit('close', 0);

      await promise;
      expect(writeSpy).not.toHaveBeenCalled();

      writeSpy.mockRestore();
    });
  });

  describe('checkCommandExists', () => {
    it('should return true when command exists', async () => {
      const promise = checkCommandExists('node');

      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[0]).toContain('which');

      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return false when command does not exist', async () => {
      const promise = checkCommandExists('nonexistent');

      mockProcess.emit('close', 1);

      const result = await promise;
      expect(result).toBe(false);
    });
  });
});
