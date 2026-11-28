import {
  createErrorReporter,
  createMaintenance,
  createTrialReminders,
  createWeeklyReminders,
} from '@globetrot/application';
import {
  connectDatabase,
  createMaintenanceRepository,
  createNoticeRepository,
  createWeeklyNoticeRepository,
} from '@globetrot/db';
import { createSmtpEmail } from '@globetrot/mailer';
import { createS3Storage } from '@globetrot/storage';
import { loadWorkerConfig } from './config';
import { startWorker } from './worker';

/** An arbitrary, fixed advisory-lock key: one housekeeping round at a time across every worker instance. */
const MAINTENANCE_LOCK = 4_718_221;

const config = loadWorkerConfig();
// Error monitoring (ADR-0021): only with a DSN, and without anything personal.
const monitoring = createErrorReporter({
  dsn: config.sentryDsn,
  environment: process.env.NODE_ENV ?? 'development',
  service: 'worker',
});
process.on('unhandledRejection', (reason) => monitoring.report(reason));
const database = connectDatabase(config.databaseUrl, { max: 3 });
const maintenance = createMaintenance({
  store: createMaintenanceRepository(database.db),
  storage: createS3Storage(config.storage),
  clock: { now: () => new Date() },
});

const reminders = createTrialReminders({
  store: createNoticeRepository(database.db),
  email: createSmtpEmail(config.email),
  clock: { now: () => new Date() },
  appUrl: config.appUrl,
});

const weekly = createWeeklyReminders({
  store: createWeeklyNoticeRepository(database.db),
  email: createSmtpEmail(config.email),
  clock: { now: () => new Date() },
  appUrl: config.appUrl,
});

const worker = startWorker({
  onError: (error) => monitoring.report(error),
  firstDelayMs: 60_000,
  intervalMs: config.intervalMinutes * 60_000,
  async runOnce() {
    const client = await database.pool.connect();
    try {
      const locked = await client.query<{ ok: boolean }>('select pg_try_advisory_lock($1) as ok', [
        MAINTENANCE_LOCK,
      ]);
      if (!locked.rows[0]?.ok) return;
      try {
        const report = await maintenance.run();
        // Counts only: never ids, keys or names.
        console.log(
          `maintenance: ${report.unplacedMedia} unplaced uploads, ${report.strayObjects} stray objects, ${report.idempotencyKeys} idempotency records, ${report.unconfirmedInterest} unconfirmed interest-list entries removed`,
        );
        const notices = await reminders.run();
        console.log(`trial emails: ${notices.ending} ending soon, ${notices.ended} ended`);
        const checkins = await weekly.run();
        console.log(`weekly reminders: ${checkins.sent} sent`);
      } finally {
        await client.query('select pg_advisory_unlock($1)', [MAINTENANCE_LOCK]);
      }
    } finally {
      client.release();
    }
  },
});

const shutdown = () => {
  void worker
    .stop()
    .then(() => database.close())
    .then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
