import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export interface ConnectOptions {
  /** Maximum pool size. Defaults to 10. */
  readonly max?: number;
}

/** A Drizzle client plus the pool behind it. Call `close()` when finished. */
export function connectDatabase(url: string, options: ConnectOptions = {}) {
  const pool = new Pool({ connectionString: url, max: options.max ?? 10 });
  // An idle connection can be dropped by the server (restart, `DROP DATABASE ... FORCE`). Without a
  // listener, Node would crash on the unhandled 'error' event instead of reconnecting on next use.
  pool.on('error', (error) => console.error(`database pool error: ${error.message}`));
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}

export type DatabaseHandle = ReturnType<typeof connectDatabase>;
export type Database = DatabaseHandle['db'];
