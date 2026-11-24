import { z } from 'zod';

/** Thrown for a missing or malformed setting. The message never repeats the value (it may hold a password). */
export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
      url.hostname !== '' &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .refine(isPostgresUrl, 'must be a postgres:// or postgresql:// URL that names a database'),
});

export interface DatabaseConfig {
  readonly url: string;
}

/**
 * Reads and validates the database settings. This is the only place in the package that touches
 * `process.env` (entrypoints call it; everything else receives the typed result).
 */
export function loadDatabaseConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DatabaseConfig {
  const parsed = envSchema.safeParse({ DATABASE_URL: env.DATABASE_URL });
  if (!parsed.success) {
    const reason = parsed.error.issues[0]?.message ?? 'is invalid';
    throw new DatabaseConfigError(`DATABASE_URL ${reason}`);
  }
  return { url: parsed.data.DATABASE_URL };
}
