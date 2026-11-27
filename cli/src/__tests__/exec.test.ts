import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { fakeChildProcess } from './helpers/process';
import type { FakeChildProcess } from './helpers/process';
import { silenceLogger } from './helpers/logger';
import {
  executeCommand,
  checkCommandExists,
  getGradlew,
  requireTool,
  signalProcessTree,
} from '../utils/exec';
import { logger } from '../utils/logger';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

const mockedSpawn = spawn as jest.Mock;

/** A process the CLI started, as `signalProcessTree` takes it; without a pid when none is given. */
function started(pid?: number): ChildProcess {
  const child = fakeChildProcess();
  child.pid = pid;
  return child as unknown as ChildProcess;
}

describe('exec utils', () => {
  const platform = process.platform;
  let child: FakeChildProcess;
  let kill: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    silenceLogger();
    // signalProcessTree is the real one here, and signals a real process group:
    // no pid a test makes up may reach the real process.kill.
    kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
    child = fakeChildProcess();
    mockedSpawn.mockReturnValue(child);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(process, 'platform', { value: platform });
  });

  describe('getGradlew', () => {
    it('should return gradlew.bat on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(getGradlew()).toBe('gradlew.bat');
    });

    it('should return ./gradlew on non-win32', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(getGradlew()).toBe('./gradlew');
    });
  });

  describe('executeCommand', () => {
    it('should handle command without args', async () => {
      const promise = executeCommand('echo');

      expect(mockedSpawn).toHaveBeenNthCalledWith(1, 'echo', [], {});

      child.stdout.emit('data', Buffer.from('\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('should return success:false on non-zero exit code', async () => {
      const promise = executeCommand('false');

      child.stderr.emit('data', Buffer.from('error msg'));
      child.emit('close', 1);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('error msg');
      expect(result.code).toBe(1);
    });

    it('should handle spawn error', async () => {
      const promise = executeCommand('nonexistent');

      child.emit('error', new Error('spawn error'));

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('spawn error');
      expect(result.code).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to execute command: spawn error');
    });

    it('should capture both stdout and stderr', async () => {
      const promise = executeCommand('cmd');

      child.stdout.emit('data', Buffer.from('out'));
      child.stderr.emit('data', Buffer.from('err'));
      child.emit('close', 0);

      const result = await promise;
      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err');
    });

    it('should trim whitespace from output', async () => {
      const promise = executeCommand('echo');

      child.stdout.emit('data', Buffer.from('  hello  \n'));
      child.emit('close', 0);

      const result = await promise;
      expect(result.stdout).toBe('hello');
    });

    it('should pass spawn options', async () => {
      const promise = executeCommand('echo', ['test'], { cwd: '/tmp' });

      expect(mockedSpawn).toHaveBeenNthCalledWith(1, 'echo', ['test'], { cwd: '/tmp' });

      child.emit('close', 0);
      await promise;
    });

    it('should write stdout to process.stdout when stdio is inherit', async () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const promise = executeCommand('echo', ['hello'], { stdio: 'inherit' });

      child.stdout.emit('data', Buffer.from('hello\n'));
      child.emit('close', 0);

      const result = await promise;
      expect(writeSpy).toHaveBeenCalledWith('hello\n');
      expect(result.stdout).toBe('hello');
    });

    it('should write stderr to process.stderr when stdio is inherit', async () => {
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation();

      const promise = executeCommand('cmd', [], { stdio: 'inherit' });

      child.stderr.emit('data', Buffer.from('err\n'));
      child.emit('close', 1);

      const result = await promise;
      expect(writeSpy).toHaveBeenCalledWith('err\n');
      expect(result.stderr).toBe('err');
    });

    it('should not write stdout to process.stdout when stdio is pipe', async () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      const promise = executeCommand('echo', ['hello'], { stdio: 'pipe' });

      child.stdout.emit('data', Buffer.from('hello\n'));
      child.emit('close', 0);

      await promise;
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkCommandExists', () => {
    it('should return true when command exists', async () => {
      const promise = checkCommandExists('node');

      expect(mockedSpawn).toHaveBeenNthCalledWith(1, 'which', ['node'], { stdio: 'pipe' });

      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return false when command does not exist', async () => {
      const promise = checkCommandExists('nonexistent');

      child.emit('close', 1);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should use where on win32', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const promise = checkCommandExists('node');

      expect(mockedSpawn).toHaveBeenNthCalledWith(1, 'where', ['node'], { stdio: 'pipe' });

      child.emit('close', 0);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('requireTool', () => {
    it('should resolve when tool exists', async () => {
      const promise = requireTool('node', 'install node');
      child.emit('close', 0);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should throw ToolRequiredError when tool not found', async () => {
      const promise = requireTool('missing-tool', 'install it');
      child.emit('close', 1);

      await expect(promise).rejects.toThrow('Required tool');
    });
  });

  describe('signalProcessTree', () => {
    it('should signal the process group a detached child leads', () => {
      const detached = started(1001);

      signalProcessTree(detached, 'SIGTERM');

      expect(kill).toHaveBeenCalledWith(-1001, 'SIGTERM');
      expect(detached.kill).not.toHaveBeenCalled();
    });

    it('should signal the child itself when it leads no process group', () => {
      const ungrouped = started(1001);
      kill.mockImplementation(() => {
        throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      });

      signalProcessTree(ungrouped, 'SIGKILL');

      expect(ungrouped.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should do nothing when the child has no pid', () => {
      const pidless = started();

      signalProcessTree(pidless, 'SIGKILL');

      expect(kill).not.toHaveBeenCalled();
      expect(pidless.kill).not.toHaveBeenCalled();
    });
  });
});
