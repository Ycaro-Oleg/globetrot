import { loadDatabaseConfig } from '@globetrot/db';
import { z } from 'zod';

/**
 * Public on purpose: it is the value `.env.example` ships so local development works with no setup.
 * Production refuses it, so a copied example file can never reach a real deployment.
 */
export const INSECURE_DEV_SECRET = 'insecure-local-development-secret-never-use-in-production';
export const MIN_SECRET_LENGTH = 32;

const DAY = 60 * 60 * 24;

/** Thrown for any invalid or unsafe setting. Messages name the setting, never its value. */
export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

const number = (fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  TRUSTED_ORIGINS: z.string().optional(),
  SESSION_EXPIRES_IN_SECONDS: number(30 * DAY, 60),
  SESSION_UPDATE_AGE_SECONDS: number(DAY, 60),
  AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE: number(5, 1, 1000),
  AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE: number(5, 1, 1000),
  REQUIRE_VERIFIED_EMAIL: z.enum(['true', 'false']).default('true'),
  VERIFICATION_EXPIRES_IN_SECONDS: number(DAY, 1),
  RESET_PASSWORD_EXPIRES_IN_SECONDS: number(60 * 60, 1),
  EMAIL_COOLDOWN_SECONDS: number(30, 1, 3600),
  AUTH_EMAIL_REQUESTS_PER_MINUTE: number(5, 1, 1000),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: number(1025, 1, 65535),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Globetrot <hello@globetrot.local>'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GEOAPIFY_API_KEY: z.string().optional(),
  S3_ENDPOINT: z.url().default('http://localhost:8333'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('globetrot-media'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
  PORT: number(4000, 1, 65535),
});

export interface AuthConfig {
  readonly secret: string;
  /** The public origin of the *web* app. The browser only ever talks to it; it proxies `/api/auth/*` to this API. */
  readonly baseURL: string;
  readonly trustedOrigins: readonly string[];
  /** Seconds a session lives. */
  readonly sessionExpiresIn: number;
  /** A session older than this many seconds is renewed on use. */
  readonly sessionUpdateAge: number;
  readonly signInAttemptsPerMinute: number;
  readonly signUpAttemptsPerMinute: number;
  readonly secureCookies: boolean;
  /** A password sign-in needs a verified email. Google sign-in counts as verified. */
  readonly requireVerifiedEmail: boolean;
  /** Seconds a verification link works. */
  readonly verificationExpiresIn: number;
  /** Seconds a password-reset link works. */
  readonly resetPasswordExpiresIn: number;
  /** Seconds before the same address can be sent another verification or reset email. */
  readonly emailCooldownSeconds: number;
  /** Resend and reset requests per minute from one client address. */
  readonly emailRequestsPerMinute: number;
  /** Google sign-in, or `null` when no credentials are set (the provider is then off and the button hidden). */
  readonly google: { readonly clientId: string; readonly clientSecret: string } | null;
}

export interface EmailConfig {
  readonly host: string;
  readonly port: number;
  /** `Name <address>` shown as the sender. */
  readonly from: string;
  readonly user: string | undefined;
  readonly password: string | undefined;
}

export interface StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** `bucket` in the path (SeaweedFS, most self-hosted S3) rather than in the host name. */
  readonly forcePathStyle: boolean;
}

/** The local storage's credentials from `.env.example`. Production refuses them. */
const DEV_STORAGE_KEY = 'globetrot-dev';
const DEV_STORAGE_SECRET = 'globetrot-dev-secret';

export interface ApiConfig {
  readonly nodeEnv: 'production' | 'test' | 'development';
  readonly isProduction: boolean;
  readonly port: number;
  readonly databaseUrl: string;
  /** Server-side Geoapify key for place search; `null` turns search off (it answers 503). */
  readonly geoapifyKey: string | null;
  readonly auth: AuthConfig;
  readonly email: EmailConfig;
  /** S3-compatible storage for uploaded images (SeaweedFS locally). */
  readonly storage: StorageConfig;
  /** True when no secret was provided and the public development one is in use (never in production). */
  readonly usingInsecureSecret: boolean;
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      try {
        return new URL(part).origin;
      } catch {
        throw new ApiConfigError(`TRUSTED_ORIGINS has an entry that is not a URL: "${part}"`);
      }
    });
}

/**
 * Reads and validates the API settings. The only place in the API that touches `process.env`.
 * In production it refuses to start with a missing, short or default `BETTER_AUTH_SECRET`, or with a
 * `BETTER_AUTH_URL` that is not https (session cookies are `Secure` there).
 */
export function loadApiConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ApiConfig {
  // `KEY=` in a .env file means "unset", not an empty string.
  const present = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== ''),
  );
  // PORT is set by the container platform (Coolify); API_PORT comes from the local .env.
  const parsed = envSchema.safeParse({ ...present, PORT: present.PORT ?? present.API_PORT });
  if (!parsed.success) {
    throw new ApiConfigError(
      parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
        .join('; '),
    );
  }
  const values = parsed.data;

  const nodeEnv =
    values.NODE_ENV === 'production'
      ? 'production'
      : values.NODE_ENV === 'test'
        ? 'test'
        : 'development';
  const isProduction = nodeEnv === 'production';
  const databaseUrl = loadDatabaseConfig(present).url;

  const provided = present.BETTER_AUTH_SECRET;
  let secret: string;
  if (provided === undefined) {
    if (isProduction) throw new ApiConfigError('BETTER_AUTH_SECRET is required in production');
    secret = INSECURE_DEV_SECRET;
  } else {
    secret = provided;
  }
  if (isProduction) {
    if (secret === INSECURE_DEV_SECRET) {
      throw new ApiConfigError(
        'BETTER_AUTH_SECRET must not be the public development secret in production',
      );
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new ApiConfigError(
        `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
      );
    }
    if (new URL(values.BETTER_AUTH_URL).protocol !== 'https:') {
      throw new ApiConfigError('BETTER_AUTH_URL must use https in production');
    }
    // Accounts cannot be verified or recovered without a mail server, and the local defaults (Mailpit, a
    // `.local` sender) never reach a real inbox.
    if (present.SMTP_HOST === undefined)
      throw new ApiConfigError('SMTP_HOST is required in production');
    if (present.EMAIL_FROM === undefined)
      throw new ApiConfigError('EMAIL_FROM is required in production');
    // Photos must not land in a local bucket or use the published development credentials.
    for (const name of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (present[name] === undefined)
        throw new ApiConfigError(`${name} is required in production`);
    }
    if (
      present.S3_ACCESS_KEY_ID === DEV_STORAGE_KEY ||
      present.S3_SECRET_ACCESS_KEY === DEV_STORAGE_SECRET
    ) {
      throw new ApiConfigError(
        'S3 credentials must not be the local development ones in production',
      );
    }
  }

  // Google is on only with both values; one without the other is a mistake worth stopping for.
  if ((values.GOOGLE_CLIENT_ID === undefined) !== (values.GOOGLE_CLIENT_SECRET === undefined)) {
    throw new ApiConfigError('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together');
  }
  const google =
    values.GOOGLE_CLIENT_ID !== undefined && values.GOOGLE_CLIENT_SECRET !== undefined
      ? { clientId: values.GOOGLE_CLIENT_ID, clientSecret: values.GOOGLE_CLIENT_SECRET }
      : null;

  const baseOrigin = new URL(values.BETTER_AUTH_URL).origin;
  const trustedOrigins = [...new Set([baseOrigin, ...parseOrigins(values.TRUSTED_ORIGINS)])];

  return {
    nodeEnv,
    isProduction,
    port: values.PORT,
    databaseUrl,
    geoapifyKey: values.GEOAPIFY_API_KEY ?? null,
    storage: {
      endpoint: values.S3_ENDPOINT,
      region: values.S3_REGION,
      bucket: values.S3_BUCKET,
      accessKeyId: values.S3_ACCESS_KEY_ID ?? DEV_STORAGE_KEY,
      secretAccessKey: values.S3_SECRET_ACCESS_KEY ?? DEV_STORAGE_SECRET,
      forcePathStyle: values.S3_FORCE_PATH_STYLE === 'true',
    },
    usingInsecureSecret: secret === INSECURE_DEV_SECRET,
    auth: {
      secret,
      baseURL: baseOrigin,
      trustedOrigins,
      sessionExpiresIn: values.SESSION_EXPIRES_IN_SECONDS,
      sessionUpdateAge: values.SESSION_UPDATE_AGE_SECONDS,
      signInAttemptsPerMinute: values.AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE,
      signUpAttemptsPerMinute: values.AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE,
      secureCookies: isProduction,
      requireVerifiedEmail: values.REQUIRE_VERIFIED_EMAIL === 'true',
      verificationExpiresIn: values.VERIFICATION_EXPIRES_IN_SECONDS,
      resetPasswordExpiresIn: values.RESET_PASSWORD_EXPIRES_IN_SECONDS,
      emailCooldownSeconds: values.EMAIL_COOLDOWN_SECONDS,
      emailRequestsPerMinute: values.AUTH_EMAIL_REQUESTS_PER_MINUTE,
      google,
    },
    email: {
      host: values.SMTP_HOST,
      port: values.SMTP_PORT,
      from: values.EMAIL_FROM,
      user: values.SMTP_USER,
      password: values.SMTP_PASSWORD,
    },
  };
}
