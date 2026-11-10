import { createHash } from 'node:crypto';
import type { EmailPort, EmailTemplate } from '@globetrot/application';
import { createCooldown, createPreferencesRepository, schema, type Database } from '@globetrot/db';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@globetrot/domain';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  localeFromCookieHeader,
  type SupportedLocale,
} from '@globetrot/i18n';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AuthConfig } from './config';

export const MIN_PASSWORD_LENGTH = PASSWORD_MIN_LENGTH;
export const MAX_PASSWORD_LENGTH = PASSWORD_MAX_LENGTH;

/** Window of the rate limiter, in seconds. Limits are expressed per minute in the config. */
const RATE_LIMIT_WINDOW = 60;

/** The endpoints that make us send an email. Each has a per-address cooldown and a per-client limit. */
const EMAIL_REQUEST_PATHS = new Set(['/send-verification-email', '/request-password-reset']);

export interface AuthDependencies {
  readonly email: EmailPort;
}

const errorCode = (error: unknown) => {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'unknown error';
};

/**
 * Better Auth for Globetrot (ADR-0005): e-mail + password, cookie sessions, rate limits stored in
 * PostgreSQL, e-mail verification and password reset. Passwords are hashed by Better Auth; nothing here
 * touches them. Never log tokens, passwords or e-mail addresses.
 */
export function createAuth(db: Database, config: AuthConfig, { email }: AuthDependencies) {
  const preferences = createPreferencesRepository(db);
  const cooldown = createCooldown(db);

  /**
   * The language of an email: the stored preference when there is one, otherwise the language cookie sent with
   * the request (at sign-up the row may not exist yet), otherwise the default. Never `Accept-Language`.
   */
  async function localeFor(userId: string, request: Request | undefined): Promise<SupportedLocale> {
    const stored = await preferences.find(userId);
    if (stored && isSupportedLocale(stored.locale)) return stored.locale;
    return localeFromCookieHeader(request?.headers.get('cookie')) ?? DEFAULT_LOCALE;
  }

  /**
   * Sends in the background and returns at once. If the request waited for the mail server, an address that
   * has an account (a mail is sent) would answer more slowly than one that does not (nothing is sent), and
   * anyone could tell them apart by timing. Failures are logged with a code only: no address, no link.
   */
  function deliver(
    template: EmailTemplate,
    user: { id: string; email: string; name: string },
    url: string,
    request: Request | undefined,
    expiresInSeconds: number,
  ): void {
    void (async () => {
      try {
        const locale = await localeFor(user.id, request);
        await email.send({
          to: user.email,
          template,
          locale,
          data: { url, name: user.name, expiresInHours: expiresInSeconds / 3600 },
        });
      } catch (error) {
        console.error(`could not send the ${template} email (${errorCode(error)})`);
      }
    })();
  }

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
      // A password sign-in needs a verified address (refused with EMAIL_NOT_VERIFIED). Google counts as verified.
      requireEmailVerification: config.requireVerifiedEmail,
      // The reset token lives in the `verification` table and is deleted when used: it works once.
      resetPasswordTokenExpiresIn: config.resetPasswordExpiresIn,
      // A reset ends every session of the account, so whoever had the old password is signed out.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        deliver('resetPassword', user, url, request, config.resetPasswordExpiresIn);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Following the link signs the person in. Opening it again changes nothing and signs nobody in.
      autoSignInAfterVerification: true,
      expiresIn: config.verificationExpiresIn,
      sendVerificationEmail: async ({ user, url }, request) => {
        deliver('verifyEmail', user, url, request, config.verificationExpiresIn);
      },
    },
    // Google only when both credentials are configured. The redirect URI Google must allow is
    // `<BETTER_AUTH_URL>/api/auth/callback/google` (the web origin, which proxies /api/auth/*).
    ...(config.google
      ? {
          socialProviders: {
            google: {
              clientId: config.google.clientId,
              clientSecret: config.google.clientSecret,
            },
          },
        }
      : {}),
    account: {
      // A Google identity links to an existing account only when Google reports the address as verified and it
      // equals the account's address; otherwise sign-in fails with an explicit error. No provider is trusted to
      // skip that check, and an address that differs is never linked.
      accountLinking: { enabled: true, trustedProviders: [], allowDifferentEmails: false },
    },
    // A failed callback (denied consent, bad state, a refused link) lands on the sign-in page with a short code,
    // never an error page with details.
    onAPIError: { errorURL: `${config.baseURL}/login` },
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
        '/send-verification-email': {
          window: RATE_LIMIT_WINDOW,
          max: config.emailRequestsPerMinute,
        },
        '/request-password-reset': {
          window: RATE_LIMIT_WINDOW,
          max: config.emailRequestsPerMinute,
        },
      },
    },
    advanced: {
      cookiePrefix: 'globetrot',
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    databaseHooks: {
      user: {
        create: {
          // A new account starts with the language the person was using, read from the language cookie the
          // web app sends along. Everything else takes the defaults (USD, no country, nationality or time
          // zone). If this fails the account still exists and `getPreferences` falls back to the same
          // defaults, so sign-up must not fail because of it.
          after: async (created, context) => {
            const cookie =
              context?.headers?.get('cookie') ?? context?.request?.headers.get('cookie');
            const locale = localeFromCookieHeader(cookie) ?? DEFAULT_LOCALE;
            try {
              await preferences.createDefaults(created.id, locale, new Date());
            } catch (error) {
              console.error(`could not record the sign-up language (${errorCode(error)})`);
            }
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body = ctx.body as { email?: unknown } | undefined;
        if (!body || typeof body.email !== 'string') return;

        // E-mail addresses are trimmed (Better Auth lower-cases them) so " Ana@Example.com " and
        // "ana@example.com" are the same account instead of a validation error.
        const address = body.email.trim();

        // One email per address every `emailCooldownSeconds`, whoever asks and from wherever. It applies to the
        // address as typed, **whether or not an account exists**, so the answer (200, or 429 with the same
        // wait) never tells an unknown address from a known one.
        if (EMAIL_REQUEST_PATHS.has(ctx.path)) {
          const digest = createHash('sha256').update(address.toLowerCase()).digest('hex');
          const wait = await cooldown.acquire(
            `email-cooldown:${ctx.path}:${digest}`,
            config.emailCooldownSeconds,
            Date.now(),
          );
          if (wait > 0) {
            throw new APIError(
              'TOO_MANY_REQUESTS',
              { code: 'EMAIL_COOLDOWN', message: 'Please wait before asking for another email' },
              { 'Retry-After': String(wait) },
            );
          }
        }

        if (body.email !== address) {
          return { context: { ...ctx, body: { ...body, email: address } } };
        }
      }),
    },
    logger: { level: 'warn' },
  });
}

export type Auth = ReturnType<typeof createAuth>;
