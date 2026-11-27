import type { PriceCurrency } from '@globetrot/domain';
import { loadDatabaseConfig } from '@globetrot/db';
import { storageConfigFromEnv, StorageConfigError, type StorageConfig } from '@globetrot/storage';
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
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-flash'),
  SENTRY_DSN: z.url().optional(),
  ADMIN_EMAILS: z.string().optional(),
  INBOUND_EMAIL_SECRET: z.string().min(24).optional(),
  INBOUND_EMAIL_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)
    .optional(),
  INBOUND_EMAIL_LOCAL: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default('trips'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.url().default('https://api.anthropic.com'),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-5-5'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_EXPLORER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXPLORER_YEARLY: z.string().optional(),
  STRIPE_PRICE_VOYAGER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_VOYAGER_YEARLY: z.string().optional(),
  STRIPE_PRICE_TOP_UP: z.string().optional(),
  STRIPE_PRICE_TRIP_PASS: z.string().optional(),
  // Prices in reais (ADR-0023); each one unset falls back to the USD price above.
  STRIPE_PRICE_EXPLORER_MONTHLY_BRL: z.string().optional(),
  STRIPE_PRICE_EXPLORER_YEARLY_BRL: z.string().optional(),
  STRIPE_PRICE_VOYAGER_MONTHLY_BRL: z.string().optional(),
  STRIPE_PRICE_VOYAGER_YEARLY_BRL: z.string().optional(),
  STRIPE_PRICE_TOP_UP_BRL: z.string().optional(),
  STRIPE_PRICE_TRIP_PASS_BRL: z.string().optional(),
  // The small credit pack (ADR-0033); optional: without it that pack's checkout is not offered.
  STRIPE_PRICE_TOP_UP_SMALL: z.string().optional(),
  STRIPE_PRICE_TOP_UP_SMALL_BRL: z.string().optional(),
  PORT: number(4000, 1, 65535),
});

const STRIPE_SETTINGS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_EXPLORER_MONTHLY',
  'STRIPE_PRICE_EXPLORER_YEARLY',
  'STRIPE_PRICE_VOYAGER_MONTHLY',
  'STRIPE_PRICE_VOYAGER_YEARLY',
  'STRIPE_PRICE_TOP_UP',
  'STRIPE_PRICE_TRIP_PASS',
] as const;

/** The Stripe Price ids of one price currency. */
export interface StripePriceIds {
  readonly explorer: { readonly month: string; readonly year: string };
  readonly voyager: { readonly month: string; readonly year: string };
  readonly topUp: string;
  /** The small pack (ADR-0033); null while its Price is not set. */
  readonly topUpSmall: string | null;
  readonly tripPass: string;
}

export interface StripeConfig {
  readonly secretKey: string;
  readonly webhookSecret: string;
  /** Per price currency; a BRL price not set is the USD one (ADR-0023). */
  readonly prices: Readonly<Record<PriceCurrency, StripePriceIds>>;
  /** The public web origin: where checkout returns the person. */
  readonly returnOrigin: string;
}

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

export interface ApiConfig {
  readonly nodeEnv: 'production' | 'test' | 'development';
  readonly isProduction: boolean;
  readonly port: number;
  readonly databaseUrl: string;
  /** Server-side Geoapify key for place search; `null` turns search off (it answers 503). */
  readonly geoapifyKey: string | null;
  readonly auth: AuthConfig;
  readonly email: EmailConfig;
  /** Pip's model (DeepSeek); `null` turns Pip off (asking answers 503). */
  readonly ai: { readonly apiKey: string; readonly baseUrl: string; readonly model: string } | null;
  /** The second model (Anthropic, ADR-0022), asked when the first does not answer; `null` when no key is set. */
  readonly aiFallback: {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly model: string;
  } | null;
  /** S3-compatible storage for uploaded images (SeaweedFS locally). */
  readonly storage: StorageConfig;
  /** Stripe (ADR-0019); `null` keeps payments off (checkout answers 503). */
  readonly stripe: StripeConfig | null;
  /** Where unexpected errors are reported (Sentry, ADR-0021); `null` keeps them in the logs only. */
  readonly sentryDsn: string | null;
  /** Lower-case addresses that may see the internal dashboard (ADR-0031); empty for nobody. */
  readonly adminEmails: readonly string[];
  /** Booking emails forwarded to Pip (ADR-0032); `null` keeps the inbound route off. */
  readonly inboundEmail: {
    readonly secret: string;
    readonly domain: string;
    readonly local: string;
  } | null;
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
  }

  // Google is on only with both values; one without the other is a mistake worth stopping for.
  if ((values.GOOGLE_CLIENT_ID === undefined) !== (values.GOOGLE_CLIENT_SECRET === undefined)) {
    throw new ApiConfigError('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together');
  }
  const google =
    values.GOOGLE_CLIENT_ID !== undefined && values.GOOGLE_CLIENT_SECRET !== undefined
      ? { clientId: values.GOOGLE_CLIENT_ID, clientSecret: values.GOOGLE_CLIENT_SECRET }
      : null;

  let storage: StorageConfig;
  try {
    storage = storageConfigFromEnv(present, isProduction);
  } catch (error) {
    if (error instanceof StorageConfigError) throw new ApiConfigError(error.message);
    throw error;
  }

  const baseOrigin = new URL(values.BETTER_AUTH_URL).origin;
  const trustedOrigins = [...new Set([baseOrigin, ...parseOrigins(values.TRUSTED_ORIGINS)])];

  // Payments are all or nothing: half a Stripe setup would take money it cannot record.
  const stripeSet = STRIPE_SETTINGS.filter((name) => values[name] !== undefined);
  if (stripeSet.length > 0 && stripeSet.length < STRIPE_SETTINGS.length) {
    const missing = STRIPE_SETTINGS.filter((name) => values[name] === undefined);
    throw new ApiConfigError(`Stripe needs every setting; missing: ${missing.join(', ')}`);
  }
  let stripe: StripeConfig | null = null;
  if (stripeSet.length === STRIPE_SETTINGS.length) {
    const secretKey = values.STRIPE_SECRET_KEY!;
    if (!/^(sk|rk)_(test|live)_/.test(secretKey)) {
      throw new ApiConfigError('STRIPE_SECRET_KEY is not a Stripe secret or restricted key');
    }
    if (secretKey.includes('_live_') && !isProduction) {
      throw new ApiConfigError('A live STRIPE_SECRET_KEY is only accepted in production');
    }
    if (!values.STRIPE_WEBHOOK_SECRET!.startsWith('whsec_')) {
      throw new ApiConfigError(
        'STRIPE_WEBHOOK_SECRET must be the endpoint signing secret (whsec_…)',
      );
    }
    stripe = {
      secretKey,
      webhookSecret: values.STRIPE_WEBHOOK_SECRET!,
      prices: {
        USD: {
          explorer: {
            month: values.STRIPE_PRICE_EXPLORER_MONTHLY!,
            year: values.STRIPE_PRICE_EXPLORER_YEARLY!,
          },
          voyager: {
            month: values.STRIPE_PRICE_VOYAGER_MONTHLY!,
            year: values.STRIPE_PRICE_VOYAGER_YEARLY!,
          },
          topUp: values.STRIPE_PRICE_TOP_UP!,
          topUpSmall: values.STRIPE_PRICE_TOP_UP_SMALL ?? null,
          tripPass: values.STRIPE_PRICE_TRIP_PASS!,
        },
        BRL: {
          explorer: {
            month:
              values.STRIPE_PRICE_EXPLORER_MONTHLY_BRL ?? values.STRIPE_PRICE_EXPLORER_MONTHLY!,
            year: values.STRIPE_PRICE_EXPLORER_YEARLY_BRL ?? values.STRIPE_PRICE_EXPLORER_YEARLY!,
          },
          voyager: {
            month: values.STRIPE_PRICE_VOYAGER_MONTHLY_BRL ?? values.STRIPE_PRICE_VOYAGER_MONTHLY!,
            year: values.STRIPE_PRICE_VOYAGER_YEARLY_BRL ?? values.STRIPE_PRICE_VOYAGER_YEARLY!,
          },
          topUp: values.STRIPE_PRICE_TOP_UP_BRL ?? values.STRIPE_PRICE_TOP_UP!,
          topUpSmall:
            values.STRIPE_PRICE_TOP_UP_SMALL_BRL ?? values.STRIPE_PRICE_TOP_UP_SMALL ?? null,
          tripPass: values.STRIPE_PRICE_TRIP_PASS_BRL ?? values.STRIPE_PRICE_TRIP_PASS!,
        },
      },
      returnOrigin: new URL(values.BETTER_AUTH_URL).origin,
    };
  }

  return {
    nodeEnv,
    isProduction,
    port: values.PORT,
    databaseUrl,
    geoapifyKey: values.GEOAPIFY_API_KEY ?? null,
    ai:
      values.DEEPSEEK_API_KEY === undefined
        ? null
        : {
            apiKey: values.DEEPSEEK_API_KEY,
            baseUrl: values.DEEPSEEK_BASE_URL,
            model: values.DEEPSEEK_MODEL,
          },
    aiFallback:
      values.ANTHROPIC_API_KEY === undefined
        ? null
        : {
            apiKey: values.ANTHROPIC_API_KEY,
            baseUrl: values.ANTHROPIC_BASE_URL,
            model: values.ANTHROPIC_MODEL,
          },
    storage,
    stripe,
    sentryDsn: values.SENTRY_DSN ?? null,
    inboundEmail:
      values.INBOUND_EMAIL_SECRET && values.INBOUND_EMAIL_DOMAIN
        ? {
            secret: values.INBOUND_EMAIL_SECRET,
            domain: values.INBOUND_EMAIL_DOMAIN,
            local: values.INBOUND_EMAIL_LOCAL,
          }
        : null,
    adminEmails: (values.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
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
