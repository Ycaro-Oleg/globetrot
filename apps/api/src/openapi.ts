import { createApplication } from '@globetrot/application';
import { createApp, OPENAPI_CONFIG } from './app';

/** Where the committed contract lives. `@globetrot/api-client` generates its types from this file. */
export const OPENAPI_FILE = new URL('../../../packages/api-client/openapi.json', import.meta.url);

const unreachable = (): never => {
  throw new Error('Describing the contract never calls an operation');
};

/** The OpenAPI document of the running app, built without a database or an auth backend. */
export function buildOpenApiDocument() {
  const app = createApp({
    auth: { handler: unreachable, getSession: unreachable },
    application: createApplication({
      users: { findById: unreachable },
      trips: { findById: unreachable, listByOwner: unreachable },
      destinations: { listByTrip: unreachable },
      expenses: { listByTrip: unreachable, findById: unreachable },
      checklist: { listByTrip: unreachable, findById: unreachable },
      dayPlaces: { listByTrip: unreachable, findById: unreachable },
      visas: { listByUser: unreachable },
      savings: { find: unreachable },
      preferences: { find: unreachable },
      unitOfWork: { run: unreachable },
      clock: { now: unreachable },
      ids: { newId: unreachable },
      geocoding: { search: unreachable, reverse: unreachable },
      rateLimiter: { consume: unreachable },
    }),
    trustedOrigins: [],
  });
  return app.getOpenAPI31Document(OPENAPI_CONFIG);
}

/** Stable text form: what is committed and what the tests compare against. */
export const renderOpenApiDocument = () => `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
