// The release step: applies pending database migrations, then exits. Run it before starting a new API
// version (Coolify's pre-deployment command: `node dist/migrate.js`). Safe to run again and from several
// replicas at once (runMigrations takes an advisory lock). Logs no connection details.
import { fileURLToPath } from 'node:url';
import { connectDatabase, loadDatabaseConfig, runMigrations } from '@globetrot/db';

/** The image ships the migrations next to the bundle (`/app/migrations`); `MIGRATIONS_FOLDER` overrides it. */
const folder =
  process.env.MIGRATIONS_FOLDER ?? fileURLToPath(new URL('../migrations', import.meta.url));

const database = connectDatabase(loadDatabaseConfig(process.env).url, { max: 2 });
try {
  await runMigrations(database, folder);
  console.log('migrations: up to date');
} catch (error) {
  console.error(`migrations failed (${error instanceof Error ? error.name : 'unknown'})`);
  process.exitCode = 1;
} finally {
  await database.close();
}
