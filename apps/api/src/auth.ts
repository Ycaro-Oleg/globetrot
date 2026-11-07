import { schema, type Database } from '@globetrot/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import type { AuthConfig } from './config';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Window of the rate limiter, in seconds. Limits are expressed per minute in the config. */
const RATE_LIMIT_WINDOW = 60;

/**
 * Better Auth for Globetrot (ADR-0005): e-mail + password, cookie sessions, rate limits stored in
 * PostgreSQL. Passwords are hashed by Better Auth; nothing here touches them. Never log tokens,
 * passwords or full e-mail addresses.
 */
export function createAuth(db: Database, config: AuthConfig) {
  return betterAuth({
    appName: 'Globetrot',
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [...config.trustedOrigins],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      autoSignIn: true,
    },
    session: {
      expiresIn: config.sessionExpiresIn,
      updateAge: config.sessionUpdateAge,
    },
    // Enabled explicitly: by default Better Auth only limits in production. Counters live in PostgreSQL.
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: RATE_LIMIT_WINDOW,
      max: 100,
      customRules: {
        '/sign-in/email': { window: RATE_LIMIT_WINDOW, max: config.signInAttemptsPerMinute },
        '/sign-up/email': { window: RATE_LIMIT_WINDOW, max: config.signUpAttemptsPerMinute },
      },
    },
    advanced: {
      cookiePrefix: 'globetrot',
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    hooks: {
      // E-mail addresses are trimmed (Better Auth lower-cases them) so " Ana@Example.com " and
      // "ana@example.com" are the same account instead of a validation error.
      before: createAuthMiddleware(async (ctx) => {
        const body = ctx.body as { email?: unknown } | undefined;
        if (body && typeof body.email === 'string' && body.email !== body.email.trim()) {
          return { context: { ...ctx, body: { ...body, email: body.email.trim() } } };
        }
      }),
    },
    logger: { level: 'warn' },
  });
}

export type Auth = ReturnType<typeof createAuth>;
