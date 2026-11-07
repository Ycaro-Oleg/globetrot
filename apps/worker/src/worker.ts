export interface RunningWorker {
  stop(): Promise<void>;
}

type Log = (message: string) => void;

/**
 * Starts the background worker. Queues (pg-boss) are registered in later issues;
 * for now this only keeps the process alive and shuts down cleanly.
 */
export function startWorker(log: Log = console.log): RunningWorker {
  log('worker started (no queues registered yet)');
  const keepAlive = setInterval(() => undefined, 60_000);

  return {
    async stop() {
      clearInterval(keepAlive);
      log('worker stopped');
    },
  };
}
