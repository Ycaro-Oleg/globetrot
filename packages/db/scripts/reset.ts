// pnpm --filter @globetrot/db reset: drop and recreate the local database, then migrate to the latest.
import {
  assertLocalDatabase,
  assertSafeDatabaseName,
  connectDatabase,
  databaseNameOf,
  loadDatabaseConfig,
  recreateDatabase,
  runMigrations,
  withDatabase,
} from '../src';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to reset a database when NODE_ENV=production.');
}

const { url } = loadDatabaseConfig();
assertLocalDatabase(url);
const name = databaseNameOf(url);
assertSafeDatabaseName(name);

await recreateDatabase(withDatabase(url, 'postgres'), name);
const database = connectDatabase(url, { max: 2 });
try {
  await runMigrations(database);
  console.log(`Database "${name}" was rebuilt from scratch and is at the latest migration.`);
} finally {
  await database.close();
}
