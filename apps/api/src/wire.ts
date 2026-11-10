import { createApplication, type EmailPort, type UserReader } from '@globetrot/application';
import {
  createDestinationRepository,
  createPreferencesRepository,
  createTripRepository,
  createUnitOfWork,
  schema,
  type Database,
} from '@globetrot/db';
import { uuidV7 } from '@globetrot/domain';
import { eq } from 'drizzle-orm';
import { createApp, type AuthService } from './app';
import { createAuth, type Auth } from './auth';
import type { ApiConfig } from './config';
import { createSmtpEmail } from './email';

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
  overrides: { readonly email?: EmailPort } = {},
) {
  const email = overrides.email ?? createSmtpEmail(config.email);
  const auth = createAuth(db, config.auth, { email });
  const app = createApp({
    auth: toAuthService(auth),
    application: createApplication({
      users: createUserReader(db),
      trips: createTripRepository(db),
      destinations: createDestinationRepository(db),
      preferences: createPreferencesRepository(db),
      unitOfWork: createUnitOfWork(db),
      clock: { now: () => new Date() },
      ids: { newId: () => uuidV7(Date.now(), crypto.getRandomValues(new Uint8Array(10))) },
    }),
    trustedOrigins: config.auth.trustedOrigins,
    enabledProviders: config.auth.google ? ['google'] : [],
  });
  return { auth, app };
}
