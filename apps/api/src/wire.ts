import { createApplication, type UserReader } from '@globetrot/application';
import {
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
import type { AuthConfig } from './config';

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

/** Composition root of the API: database and settings in, a ready HTTP app out. */
export function createServices(db: Database, config: AuthConfig) {
  const auth = createAuth(db, config);
  const app = createApp({
    auth: toAuthService(auth),
    application: createApplication({
      users: createUserReader(db),
      trips: createTripRepository(db),
      preferences: createPreferencesRepository(db),
      unitOfWork: createUnitOfWork(db),
      clock: { now: () => new Date() },
      ids: { newId: () => uuidV7(Date.now(), crypto.getRandomValues(new Uint8Array(10))) },
    }),
    trustedOrigins: config.trustedOrigins,
  });
  return { auth, app };
}
