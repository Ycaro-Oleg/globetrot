// pnpm --filter @globetrot/db migrate: apply pending migrations to DATABASE_URL.
import { connectDatabase, loadDatabaseConfig, runMigrations } from '../src';

const { url } = loadDatabaseConfig();
const database = connectDatabase(url, { max: 2 });
try {
  await runMigrations(database);
  console.log('Migrations are up to date.');
} finally {
  await database.close();
}
