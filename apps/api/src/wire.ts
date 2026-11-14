import {
  createApplication,
  createPaymentEvents,
  type EmailPort,
  type AiPort,
  type PaymentsPort,
  type GeocodingPort,
  type StoragePort,
  type UserReader,
} from '@globetrot/application';
import {
  createAccountRepository,
  createAssistantRepository,
  createBillingRepository,
  createCommunityRepository,
  createDestinationRepository,
  createMediaRepository,
  createChecklistRepository,
  createDayPlaceRepository,
  createVisaRepository,
  createExpenseRepository,
  createSavingsRepository,
  createPreferencesRepository,
  createTripRepository,
  createUnitOfWork,
  schema,
  type Database,
} from '@globetrot/db';
import { uuidV7 } from '@globetrot/domain';
import { eq, sql } from 'drizzle-orm';
import { createApp, type AuthService } from './app';
import { createAuth, type Auth } from './auth';
import type { ApiConfig } from './config';
import { createSmtpEmail } from '@globetrot/mailer';
import { createGeoapifyGeocoder, createMemoryRateLimiter } from './places';
import { createS3Storage } from '@globetrot/storage';
import { createDeepSeekAi } from './ai';
import { createStripePayments, createStripeWebhook } from './stripe';

/** Adapter: the application's `UserReader` port over the `user` table. Selects only what the port names. */
export function createUserReader(db: Database): UserReader {
  return {
    async findById(userId) {
      const [row] = await db
        .select({
          id: schema.user.id,
          email: schema.user.email,
          name: schema.user.name,
          emailVerified: schema.user.emailVerified,
        })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1);
      return row ?? null;
    },
  };
}

/** Adapter: Better Auth as the HTTP layer's `AuthService`. */
export function toAuthService(auth: Auth): AuthService {
  return {
    handler: (request) => auth.handler(request),
    async getSession(headers) {
      const session = await auth.api.getSession({ headers });
      return session ? { userId: session.user.id } : null;
    },
  };
}

/**
 * Composition root of the API: database and settings in, a ready HTTP app out. `overrides.email` replaces the
 * SMTP sender (tests pass a recording or no-op one).
 */
export function createServices(
  db: Database,
  config: ApiConfig,
  overrides: {
    readonly email?: EmailPort;
    readonly geocoding?: GeocodingPort;
    readonly storage?: StoragePort;
    readonly ai?: AiPort;
    readonly payments?: PaymentsPort;
    /** Stands in for Stripe's HTTP API in tests. */
    readonly stripeFetch?: typeof fetch;
  } = {},
) {
  const email = overrides.email ?? createSmtpEmail(config.email);
  const billing = createBillingRepository(db);
  const payments =
    overrides.payments ??
    createStripePayments(config.stripe, billing, { fetch: overrides.stripeFetch });
  const users = createUserReader(db);
  const unitOfWork = createUnitOfWork(db);
  const clock = { now: () => new Date() };
  const ids = { newId: () => uuidV7(Date.now(), crypto.getRandomValues(new Uint8Array(10))) };
  const webhook = createStripeWebhook(
    config.stripe,
    createPaymentEvents({ users, billing, unitOfWork, clock, ids }),
    { fetch: overrides.stripeFetch },
  );
  const auth = createAuth(db, config.auth, { email });
  const app = createApp({
    auth: toAuthService(auth),
    application: createApplication({
      users,
      trips: createTripRepository(db),
      destinations: createDestinationRepository(db),
      expenses: createExpenseRepository(db),
      checklist: createChecklistRepository(db),
      dayPlaces: createDayPlaceRepository(db),
      visas: createVisaRepository(db),
      savings: createSavingsRepository(db),
      preferences: createPreferencesRepository(db),
      community: createCommunityRepository(db),
      media: createMediaRepository(db),
      account: createAccountRepository(db),
      assistant: createAssistantRepository(db),
      billing,
      // Without Stripe settings, checkout answers 503 (ADR-0019).
      payments,
      ai: overrides.ai ?? createDeepSeekAi(config.ai),
      storage: overrides.storage ?? createS3Storage(config.storage),
      unitOfWork,
      clock,
      ids,
      geocoding: overrides.geocoding ?? createGeoapifyGeocoder(config.geoapifyKey),
      rateLimiter: createMemoryRateLimiter(),
    }),
    trustedOrigins: config.auth.trustedOrigins,
    readiness: async () => {
      await db.execute(sql`select 1`);
      return true;
    },
    enabledProviders: config.auth.google ? ['google'] : [],
    paymentWebhook: config.stripe ? (raw, signature) => webhook.handle(raw, signature) : undefined,
  });
  return { auth, app };
}
