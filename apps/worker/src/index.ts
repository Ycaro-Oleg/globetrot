import { startWorker } from './worker';

const worker = startWorker();

const shutdown = () => {
  void worker.stop().then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
