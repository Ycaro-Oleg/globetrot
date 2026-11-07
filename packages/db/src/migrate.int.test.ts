import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEmptyDatabase,
  databaseExists,
  dropDatabase,
  recreateDatabase,
  withDatabase,
} from './admin';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate';
import { createTestDatabase, withTestDatabase, type TestDatabase } from './testing';

const created: TestDatabase[] = [];
const scratch: string[] = [];

async function fresh(options?: Parameters<typeof createTestDatabase>[0]) {
  const database = await createTestDatabase(options);
  created.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((database) => database.drop()));
  await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function appliedCount(database: TestDatabase): Promise<number> {
  const result = await database.pool.query(
    'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations',
  );
  return result.rows[0].n as number;
}

async function journalTags(): Promise<{ tag: string }[]> {
  const journal = JSON.parse(
    await readFile(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  );
  return journal.entries as { tag: string }[];
}

/** Everything a migration can change that we care about: extensions plus the columns of user schemas. */
async function schemaFingerprint(database: TestDatabase): Promise<string[]> {
  const result = await database.pool.query(`
    SELECT 'ext:' || extname AS item FROM pg_extension
    UNION ALL
    SELECT 'col:' || table_schema || '.' || table_name || '.' || column_name || ':' || data_type
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'drizzle')
    ORDER BY 1`);
  return result.rows.map((row) => row.item as string);
}

describe('migrations on a fresh database', () => {
  it('enable postgis, pg_trgm and unaccent, and they work', async () => {
    const database = await fresh();
    const extensions = await database.pool.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'pg_trgm', 'unaccent') ORDER BY 1",
    );
    expect(extensions.rows.map((row) => row.extname)).toEqual(['pg_trgm', 'postgis', 'unaccent']);

    const checks = await database.pool.query(`
      SELECT postgis_version() AS postgis,
             unaccent('São Paulo') AS plain,
             similarity('kyoto', 'kioto') > 0.2 AS fuzzy`);
    expect(checks.rows[0].postgis).toMatch(/^3\./);
    expect(checks.rows[0].plain).toBe('Sao Paulo');
    expect(checks.rows[0].fuzzy).toBe(true);
  });

  it('record every migration in the journal order', async () => {
    const database = await fresh();
    expect(await appliedCount(database)).toBe((await journalTags()).length);
  });
});

describe('running migrations again', () => {
  it('changes nothing when everything is already applied', async () => {
    const database = await fresh();
    const before = {
      count: await appliedCount(database),
      schema: await schemaFingerprint(database),
    };
    await runMigrations(database);
    await runMigrations(database);
    expect(await appliedCount(database)).toBe(before.count);
    expect(await schemaFingerprint(database)).toEqual(before.schema);
  });

  it('is safe when two runners start at the same time', async () => {
    const database = await fresh({ migrate: false });
    await Promise.all([runMigrations(database), runMigrations(database), runMigrations(database)]);
    expect(await appliedCount(database)).toBe((await journalTags()).length);
  });
});

describe('upgrading step by step', () => {
  it('reaches the same schema as applying everything at once', async () => {
    const tags = await journalTags();
    const journalPath = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8'));
    const stepped = await fresh({ migrate: false });
    const direct = await fresh();

    for (let upTo = 1; upTo <= tags.length; upTo++) {
      // A folder holding only the first `upTo` migrations, as the database would have seen earlier.
      const folder = await mkdtemp(path.join(tmpdir(), 'globetrot-migrations-'));
      scratch.push(folder);
      await mkdir(path.join(folder, 'meta'));
      await writeFile(
        path.join(folder, 'meta', '_journal.json'),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, upTo) }),
      );
      for (const { tag } of tags.slice(0, upTo)) {
        await cp(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), path.join(folder, `${tag}.sql`));
      }
      await migrate(stepped.db, { migrationsFolder: folder });
      expect(await appliedCount(stepped)).toBe(upTo);
    }

    expect(await schemaFingerprint(stepped)).toEqual(await schemaFingerprint(direct));
  });
});

describe('the test database helper', () => {
  it('drops the database on request and when used through withTestDatabase', async () => {
    const database = await createTestDatabase();
    const adminUrl = withDatabase(database.url, 'postgres');
    expect(database.name).toMatch(/^globetrot_test_[0-9a-f]{16}$/);
    expect(await databaseExists(adminUrl, database.name)).toBe(true);
    await database.drop();
    expect(await databaseExists(adminUrl, database.name)).toBe(false);

    let seen = '';
    await withTestDatabase(async (inner) => {
      seen = inner.name;
      await inner.pool.query('SELECT 1');
    });
    expect(await databaseExists(adminUrl, seen)).toBe(false);
  });

  it('drops the database even when the callback throws', async () => {
    let seen = '';
    let adminUrl = '';
    await expect(
      withTestDatabase(async (inner) => {
        seen = inner.name;
        adminUrl = withDatabase(inner.url, 'postgres');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await databaseExists(adminUrl, seen)).toBe(false);
  });

  it('refuses a server that is not local', async () => {
    await expect(
      createTestDatabase({ serverUrl: 'postgres://u:p@db.example.com:5432/postgres' }),
    ).rejects.toThrow(/local database/);
  });
});

describe('recreating a database (what `reset` does)', () => {
  it('wipes data and leaves an empty database behind', async () => {
    const reference = await fresh({ migrate: false });
    const adminUrl = withDatabase(reference.url, 'postgres');
    const name = `globetrot_test_${'0'.repeat(15)}1`;
    await createEmptyDatabase(adminUrl, name);
    try {
      const url = withDatabase(reference.url, name);
      const first = new Client({ connectionString: url });
      await first.connect();
      await first.query('CREATE TABLE leftovers (id int)');
      await first.end();

      await recreateDatabase(adminUrl, name);

      const second = new Client({ connectionString: url });
      await second.connect();
      const tables = await second.query(
        "SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'leftovers'",
      );
      await second.end();
      expect(tables.rows[0].n).toBe(0);
    } finally {
      await dropDatabase(adminUrl, name);
    }
  });
});
