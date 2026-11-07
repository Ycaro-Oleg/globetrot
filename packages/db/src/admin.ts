import { Client } from 'pg';

// Administrative helpers for local and test databases. They refuse anything that is not clearly local.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const SAFE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

/** Throws unless the URL points at this machine. Guards `reset` and the test helper against real servers. */
export function assertLocalDatabase(url: string): void {
  if (!isLocalHost(new URL(url).hostname)) {
    throw new Error(
      'Refusing to run: this tool only works against a local database (localhost, 127.0.0.1 or [::1]).',
    );
  }
}

export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** Same server and credentials, different database. */
export function withDatabase(url: string, name: string): string {
  const next = new URL(url);
  next.pathname = `/${encodeURIComponent(name)}`;
  return next.toString();
}

export function assertSafeDatabaseName(name: string): void {
  if (!SAFE_NAME.test(name)) {
    throw new Error(
      'Unsafe database name: use lower-case letters, digits and underscores, starting with a letter.',
    );
  }
}

/** A quoted identifier for DDL such as `CREATE DATABASE`, which cannot take bind parameters. */
export function quoteIdentifier(name: string): string {
  assertSafeDatabaseName(name);
  return `"${name}"`;
}

async function withAdminClient<T>(
  adminUrl: string,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function createEmptyDatabase(adminUrl: string, name: string): Promise<void> {
  await withAdminClient(adminUrl, (client) =>
    client.query(`CREATE DATABASE ${quoteIdentifier(name)}`),
  );
}

/** `FORCE` disconnects anyone still attached (PostgreSQL 13+). */
export async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  await withAdminClient(adminUrl, (client) =>
    client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)} WITH (FORCE)`),
  );
}

export async function recreateDatabase(adminUrl: string, name: string): Promise<void> {
  await dropDatabase(adminUrl, name);
  await createEmptyDatabase(adminUrl, name);
}

export async function databaseExists(adminUrl: string, name: string): Promise<boolean> {
  return withAdminClient(adminUrl, async (client) => {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    return result.rowCount === 1;
  });
}
