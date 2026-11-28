import { loadDatabaseConfig } from '@globetrot/db';
import type { EmailConfig } from '@globetrot/mailer';
import { storageConfigFromEnv, type StorageConfig } from '@globetrot/storage';

export interface WorkerConfig {
  readonly databaseUrl: string;
  readonly storage: StorageConfig;
  /** Minutes between rounds (housekeeping and the trial emails). */
  readonly intervalMinutes: number;
  /** The same email settings as the API (Resend's API or SMTP), for the trial and reminder emails. */
  readonly email: EmailConfig;
  /** The public web origin (`BETTER_AUTH_URL`), for links in emails. */
  readonly appUrl: string;
  /** Where unexpected errors are reported (Sentry, ADR-0021); `null` keeps them in the logs only. */
  readonly sentryDsn: string | null;
}

/** Reads the worker's settings. Messages name a setting, never its value. */
export function loadWorkerConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WorkerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const value = (name: string) =>
    env[name] === undefined || env[name] === '' ? undefined : env[name];
  const raw = value('MAINTENANCE_INTERVAL_MINUTES');
  const intervalMinutes = raw === undefined ? 60 : Number(raw);
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
    throw new Error('MAINTENANCE_INTERVAL_MINUTES must be a whole number from 1 to 1440');
  }
  // Storage first: housekeeping cannot run without it, so it is the first thing to fix.
  const storage = storageConfigFromEnv(env, isProduction);
  const appUrl = value('BETTER_AUTH_URL') ?? 'http://localhost:3000';
  let origin: URL;
  try {
    origin = new URL(appUrl);
  } catch {
    throw new Error('BETTER_AUTH_URL must be a URL');
  }
  if (isProduction) {
    if (origin.protocol !== 'https:')
      throw new Error('BETTER_AUTH_URL must use https in production');
    // Email goes through Resend's HTTPS API when its key is set, else through SMTP: one of them is needed.
    if (value('SMTP_HOST') === undefined && value('RESEND_API_KEY') === undefined)
      throw new Error('SMTP_HOST or RESEND_API_KEY is required in production');
    if (value('EMAIL_FROM') === undefined) throw new Error('EMAIL_FROM is required in production');
  }
  const port = Number(value('SMTP_PORT') ?? 1025);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a port number');
  }
  return {
    databaseUrl: loadDatabaseConfig(env).url,
    storage,
    intervalMinutes,
    appUrl: origin.origin,
    sentryDsn: value('SENTRY_DSN') ?? null,
    email: {
      host: value('SMTP_HOST') ?? 'localhost',
      port,
      from: value('EMAIL_FROM') ?? 'Globetrot <hello@globetrot.local>',
      user: value('SMTP_USER'),
      password: value('SMTP_PASSWORD'),
      resendApiKey: value('RESEND_API_KEY'),
    },
  };
}
