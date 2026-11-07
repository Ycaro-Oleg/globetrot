import { randomBytes } from 'node:crypto';
import { assertLocalDatabase, createEmptyDatabase, dropDatabase, withDatabase } from '../admin';
import { connectDatabase, type DatabaseHandle } from '../client';
import { runMigrations } from '../migrate';

// Same default as `.env.example`, so `pnpm services:up && pnpm test:int` works without any setup.
const DEFAULT_URL = 'postgres://globetrot:globetrot@localhost:5455/postgres';

export interface TestDatabase extends DatabaseHandle {
  /** The generated database name (`globetrot_test_<random>`). */
  readonly name: string;
  readonly url: string;
  /** Closes the connections and drops the database. */
  drop(): Promise<void>;
}

export interface TestDatabaseOptions {
  /** Server to create the database on. Defaults to `DATABASE_URL`, then the local compose service. */
  readonly serverUrl?: string;
  /** Set to `false` to start from an empty database. Defaults to applying every migration. */
  readonly migrate?: boolean;
}

/**
 * A throwaway database for one test or suite. It only ever creates and drops databases named
 * `globetrot_test_*`, and only on a local server.
 */
export async function createTestDatabase(options: TestDatabaseOptions = {}): Promise<TestDatabase> {
  const serverUrl = options.serverUrl ?? process.env.DATABASE_URL ?? DEFAULT_URL;
  assertLocalDatabase(serverUrl);

  const adminUrl = withDatabase(serverUrl, 'postgres');
  const name = `globetrot_test_${randomBytes(8).toString('hex')}`;
  await createEmptyDatabase(adminUrl, name);

  const url = withDatabase(serverUrl, name);
  const handle = connectDatabase(url, { max: 4 });
  try {
    if (options.migrate !== false) await runMigrations(handle);
  } catch (error) {
    await handle.close();
    await dropDatabase(adminUrl, name);
    throw error;
  }

  return {
    ...handle,
    name,
    url,
    async drop() {
      await handle.close();
      await dropDatabase(adminUrl, name);
    },
  };
}

/** Runs `fn` against a fresh database and always drops it afterwards. */
export async function withTestDatabase<T>(
  fn: (database: TestDatabase) => Promise<T>,
  options?: TestDatabaseOptions,
): Promise<T> {
  const database = await createTestDatabase(options);
  try {
    return await fn(database);
  } finally {
    await database.drop();
  }
}
