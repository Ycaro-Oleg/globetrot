/**
 * @globetrot/db: Drizzle schema, migrations and connection helpers for PostgreSQL + PostGIS.
 * Conventions: docs/architecture/data-model.md.
 */
export { DatabaseConfigError, loadDatabaseConfig, type DatabaseConfig } from './config';
export { connectDatabase, type ConnectOptions, type Database, type DatabaseHandle } from './client';
export { MIGRATIONS_FOLDER, runMigrations } from './migrate';
export * as schema from './schema';
export {
  createAuditLog,
  createIdempotencyStore,
  createPreferencesRepository,
  createTripRepository,
  createUnitOfWork,
  MAX_LISTED_TRIPS,
  type AuditLog,
  type IdempotencyStore,
  type PreferencesRepository,
  type PreferencesRow,
  type Transaction,
  type TripRepository,
  type TripRow,
} from './repositories';
export {
  assertLocalDatabase,
  assertSafeDatabaseName,
  createEmptyDatabase,
  databaseExists,
  databaseNameOf,
  dropDatabase,
  isLocalHost,
  quoteIdentifier,
  recreateDatabase,
  withDatabase,
} from './admin';
