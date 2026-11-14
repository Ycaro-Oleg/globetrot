import { loadDatabaseConfig } from '@globetrot/db';
import { storageConfigFromEnv, type StorageConfig } from '@globetrot/storage';

export interface WorkerConfig {
  readonly databaseUrl: string;
  readonly storage: StorageConfig;
  /** Minutes between housekeeping rounds. */
  readonly intervalMinutes: number;
}

/** Reads the worker's settings: the database, the storage, and how often to run. */
export function loadWorkerConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WorkerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const raw = env.MAINTENANCE_INTERVAL_MINUTES;
  const intervalMinutes = raw === undefined || raw === '' ? 60 : Number(raw);
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
    throw new Error('MAINTENANCE_INTERVAL_MINUTES must be a whole number from 1 to 1440');
  }
  return {
    databaseUrl: loadDatabaseConfig(env).url,
    storage: storageConfigFromEnv(env, isProduction),
    intervalMinutes,
  };
}
