import { createHash, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import {
  createApplication,
  createInboundEmail,
  createInterestList,
  createPaymentEvents,
  createSharedTrips,
  type InterestHasher,
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
  createShareRepository,
  createCommunityRepository,
  createDestinationRepository,
  createMediaRepository,
  createChecklistRepository,
  createMemberRepository,
  createMetricsRepository,
  createDayPlaceRepository,
  createVisaRepository,
  createExpenseRepository,
  createInterestListStore,
  createSavingsRepository,
  createPreferencesRepository,
  createTripRepository,
  createUnitOfWork,
  schema,
  type Database,
} from '@globetrot/db';
import { isInternalAddress, uuidV7 } from '@globetrot/domain';
import { getIP } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import { createApp, type AuthService } from './app';
import { createAuth, type Auth } from './auth';
import type { ApiConfig } from './config';
import { createSmtpEmail } from '@globetrot/mailer';
import { createCityIndex } from './cities';
import { createGeoapifyGeocoder, createMemoryRateLimiter } from './places';
import { createS3Storage } from '@globetrot/storage';
import { createAnthropicAi, createDeepSeekAi, fallbackAi } from './ai';
import { reportError } from './monitoring';
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

/**
 * The interest list's keyed hashing (ADR-0037). The key is derived from the auth secret with its own label, so
 * no new secret exists; rotating the auth secret voids old unsubscribe links and the suppression list.
 */
export function createInterestHasher(secret: string): InterestHasher {
  const key = Buffer.from(hkdfSync('sha256', secret, '', 'globetrot/interest-list/v1', 32));
  return {
    mac: (value) => createHmac('sha256', key).update(value).digest('base64url'),
    digest: (value) => createHash('sha256').update(value).digest('hex'),
    equal(a, b) {
      const left = Buffer.from(a);
      const right = Buffer.from(b);
      return left.length === right.length && timingSafeEqual(left, right);
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
  const ids = {
    newId: () => uuidV7(Date.now(), crypto.getRandomValues(new Uint8Array(10))),
    newToken: () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url'),
  };
  const trips = createTripRepository(db);
  const destinations = createDestinationRepository(db);
  const webhook = createStripeWebhook(
    config.stripe,
    createPaymentEvents({ users, billing, trips, destinations, unitOfWork, clock, ids }),
    { fetch: overrides.stripeFetch },
  );
  const auth = createAuth(db, config.auth, { email });
  const reads = {
    trips,
    destinations,
    expenses: createExpenseRepository(db),
    savings: createSavingsRepository(db),
    shares: createShareRepository(db),
    preferences: createPreferencesRepository(db),
  };
  const assistant = createAssistantRepository(db);
  const application = createApplication({
    ...reads,
    users,
    checklist: createChecklistRepository(db),
    members: createMemberRepository(db),
    dayPlaces: createDayPlaceRepository(db),
    visas: createVisaRepository(db),
    community: createCommunityRepository(db),
    media: createMediaRepository(db),
    account: createAccountRepository(db),
    assistant,
    billing,
    // Without Stripe settings, checkout answers 503 (ADR-0019).
    payments,
    ai:
      overrides.ai ??
      fallbackAi([createDeepSeekAi(config.ai), createAnthropicAi(config.aiFallback)]),
    storage: overrides.storage ?? createS3Storage(config.storage),
    unitOfWork,
    clock,
    ids,
    geocoding: overrides.geocoding ?? createGeoapifyGeocoder(config.geoapifyKey),
    cities: createCityIndex(),
    rateLimiter: createMemoryRateLimiter(),
    // The internal dashboard (ADR-0031): only the addresses in ADMIN_EMAILS, with a verified email.
    admins: {
      async isAdmin(userId: string) {
        const user = await users.findById(userId);
        return Boolean(
          user?.emailVerified && config.adminEmails.includes(user.email.toLowerCase()),
        );
      },
    },
    metrics: createMetricsRepository(db),
  });
  // The interest list (ADR-0037). Links point at the web origin, which proxies `/v1/*` to this API.
  const web = config.auth.baseURL;
  const query = (token: string) => `token=${encodeURIComponent(token)}`;
  const interestList = createInterestList({
    store: createInterestListStore(db),
    email,
    clock,
    ids,
    hasher: createInterestHasher(config.auth.secret),
    links: {
      confirmPage: (token, locale) => `${web}/list/confirm?${query(token)}&lang=${locale}`,
      unsubscribePage: (token, locale) => `${web}/list/unsubscribe?${query(token)}&lang=${locale}`,
      oneClick: (token) => `${web}/v1/leads/unsubscribe?${query(token)}`,
    },
    isInternal: (address) => isInternalAddress(address, config.adminEmails),
    dailyEmailCap: config.interestList.dailyEmails,
    log: (message) => console.info(message),
  });
  // Counted in memory only. The client address comes from Better Auth's own resolution with the same settings as
  // the sign-in limits, so a change to how the address is read applies to both.
  const leadLimiter = createMemoryRateLimiter();
  const app = createApp({
    auth: toAuthService(auth),
    leads: {
      list: interestList,
      allow: (request, bucket, perMinute) =>
        leadLimiter.consume(
          `leads:${bucket}:${getIP(request, auth.options) ?? 'unknown'}`,
          perMinute,
        ),
    },
    sharedTrips: createSharedTrips({ ...reads, clock }),
    application,
    trustedOrigins: config.auth.trustedOrigins,
    readiness: async () => {
      await db.execute(sql`select 1`);
      return true;
    },
    enabledProviders: config.auth.google ? ['google'] : [],
    paymentWebhook: config.stripe ? (raw, signature) => webhook.handle(raw, signature) : undefined,
    inboundEmail: config.inboundEmail
      ? {
          ...config.inboundEmail,
          receive: createInboundEmail({ assistant, trips }, application).receive,
        }
      : undefined,
    onUnexpectedError: reportError,
  });
  return { auth, app };
}
