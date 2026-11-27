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

/** The events a run of the CLI handles itself: every signal that ends it, and `exit`. */
const RUN_EVENTS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'exit'] as const;
type RunEvent = (typeof RUN_EVENTS)[number];
type Listener = () => void;
type Timer = ReturnType<typeof setTimeout>;
// The global timers carry an overload each; they are the plain functions below.
type Arm = (handler: TimerHandler, ms?: number, ...args: unknown[]) => Timer;

/** What a run of `gyo` added to the process since `watchRun()` was called. */
export interface RunEffects {
  /** The handlers a run added to `process` for `event`; the ones there before are left out. */
  added(event: RunEvent): Listener[];
  /** Runs them, as the signal itself would. */
  emit(event: RunEvent): void;
  /** Takes off everything a run added: its handlers, and the timers it still has armed. */
  restore(): void;
}

/**
 * Starts keeping track of what a run adds to the process, so that a test
 * takes off exactly that at the end: the handlers for the signals and for
 * `exit`, and the timers it arms, such as the interval it watches its
 * launcher from. What fake timers arm goes with them when they are taken off.
 */
export function watchRun(): RunEffects {
  const emitter: EventEmitter = process;
  const before = new Map(RUN_EVENTS.map((event) => [event, emitter.listeners(event)] as const));
  const timers = new Set<Timer>();

  for (const name of ['setTimeout', 'setInterval'] as const) {
    const real = globalThis[name] as unknown as Arm;
    jest.spyOn(globalThis, name).mockImplementation(((
      handler: TimerHandler,
      ms?: number,
      ...args: unknown[]
    ) => {
      const timer = real(handler, ms, ...args);
      timers.add(timer);
      return timer;
    }) as never);
  }

  const added = (event: RunEvent): Listener[] =>
    emitter
      .listeners(event)
      .filter((listener) => !before.get(event)?.includes(listener)) as Listener[];

  return {
    added,
    emit(event) {
      for (const listener of [...added(event)]) {
        listener();
      }
    },
    restore() {
      for (const event of RUN_EVENTS) {
        for (const listener of added(event)) {
          emitter.removeListener(event, listener);
        }
      }
      for (const timer of timers) {
        clearTimeout(timer);
        clearInterval(timer);
      }
      timers.clear();
    },
  };
}
