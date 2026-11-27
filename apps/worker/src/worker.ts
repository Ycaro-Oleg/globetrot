export interface RunningWorker {
  stop(): Promise<void>;
}

type Log = (message: string) => void;

export interface WorkerOptions {
  /** One round of work; it is never started again while a round is still running. */
  readonly runOnce: () => Promise<void>;
  /** Time between rounds. */
  readonly intervalMs: number;
  /** Time before the first round, so a fresh deploy settles first. */
  readonly firstDelayMs: number;
  readonly log?: Log;
  /** Called with the error of a failed round, after it is logged: error monitoring, when on. */
  readonly onError?: (error: unknown) => void;
}

/**
 * The background worker's scheduler (ADR-0017): runs a round now and then, never two at once, and on stop waits
 * for the round in progress before it resolves. A failed round is logged by kind and the next one still runs.
 */
export function startWorker(options: WorkerOptions): RunningWorker {
  const log = options.log ?? console.log;
  let running: Promise<void> | null = null;
  let stopped = false;
  const round = () => {
    if (running || stopped) return;
    running = options
      .runOnce()
      .catch((error: unknown) => {
        log(`worker round failed (${error instanceof Error ? error.name : 'unknown'})`);
        options.onError?.(error);
      })
      .finally(() => {
        running = null;
      });
  };
  const first = setTimeout(round, options.firstDelayMs);
  const every = setInterval(round, options.intervalMs);
  log('worker started');
  return {
    async stop() {
      stopped = true;
      clearTimeout(first);
      clearInterval(every);
      await running;
      log('worker stopped');
    },
  };
}
