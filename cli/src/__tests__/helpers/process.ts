import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

type Signal = Parameters<ChildProcess['kill']>[0];

/**
 * A process the CLI started, for a test that must not start one. It ends,
 * fails or prints when the test says so, and remembers how it was asked to
 * stop. The test hands it over as a `ChildProcess`.
 */
export interface FakeChildProcess extends EventEmitter {
  pid: number | undefined;
  killed: boolean;
  kill: jest.Mock<boolean, [signal?: Signal]>;
  stdout: EventEmitter;
  stderr: EventEmitter;
}

export function fakeChildProcess(pid = 4242): FakeChildProcess {
  const proc = new EventEmitter() as FakeChildProcess;
  proc.pid = pid;
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}
