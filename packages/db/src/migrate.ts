import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { DatabaseHandle } from './client';

/**
 * The committed SQL migrations. Apps that bundle this package must ship the folder with them and pass
 * its location to `runMigrations`, because `import.meta.url` then points at the bundle.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

// Arbitrary but fixed: every process that migrates this database contends on the same advisory lock.
const MIGRATION_LOCK_KEY = 5_231_052_025;

/**
 * Applies pending migrations in order. Drizzle runs them in a single transaction. The advisory lock
 * makes concurrent runners (several app replicas starting together) take turns instead of racing on
 * `CREATE EXTENSION`. Running again when nothing is pending changes nothing.
 */
export async function runMigrations(
  handle: Pick<DatabaseHandle, 'db' | 'pool'>,
  folder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  const lock = await handle.pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await migrate(handle.db, { migrationsFolder: folder });
  } finally {
    try {
      await lock.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    } finally {
      lock.release();
    }
  }
}
