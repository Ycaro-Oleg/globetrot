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
      trips: {
        findById: unreachable,
        listByOwner: unreachable,
        copiesOf: unreachable,
        roleOf: unreachable,
        listShared: unreachable,
      },
      members: {
        listByTrip: unreachable,
        findInviteByHash: unreachable,
        listOpenInvites: unreachable,
        listMoney: unreachable,
      },
      destinations: { listByTrip: unreachable, tripIdsWithPhoto: unreachable },
      expenses: { listByTrip: unreachable, findById: unreachable },
      checklist: { listByTrip: unreachable, findById: unreachable, stamps: unreachable },
      dayPlaces: { listByTrip: unreachable, findById: unreachable },
      visas: { listByUser: unreachable },
      savings: {
        find: unreachable,
        listCheckins: unreachable,
        listMiles: unreachable,
        listTripMiles: unreachable,
      },
      preferences: { find: unreachable },
      community: {
        findProfile: unreachable,
        findProfileByHandle: unreachable,
        people: unreachable,
        feed: unreachable,
        findPost: unreachable,
        postsWithMedia: unreachable,
        relations: unreachable,
        hasReported: unreachable,
        stats: unreachable,
        comments: unreachable,
        findComment: unreachable,
        suggestions: unreachable,
        trending: unreachable,
        personStats: unreachable,
        countPostsSince: unreachable,
        countCommentsSince: unreachable,
      },
      media: { findById: unreachable, findMany: unreachable },
      storage: { put: unreachable, get: unreachable, delete: unreachable, list: unreachable },
      account: { exportFor: unreachable },
      assistant: {
        findProposal: unreachable,
        listProposals: unreachable,
        countRequestsSince: unreachable,
      },
      billing: {
        findAccount: unreachable,
        findUserByProviderSubscription: unreachable,
        findProviderCustomer: unreachable,
      },
      payments: { checkoutUrl: unreachable, portalUrl: unreachable },
      shares: { findByTrip: unreachable, findBySlug: unreachable },
      ai: { completeJson: unreachable },
      unitOfWork: { run: unreachable },
      clock: { now: unreachable },
      ids: { newId: unreachable, newToken: unreachable },
      cities: { search: unreachable },
      geocoding: { search: unreachable, reverse: unreachable, sights: unreachable },
      rateLimiter: { consume: unreachable },
      admins: { isAdmin: unreachable },
      metrics: { snapshot: unreachable },
    }),
    trustedOrigins: [],
  });
  return app.getOpenAPI31Document(OPENAPI_CONFIG);
}

/** Stable text form: what is committed and what the tests compare against. */
export const renderOpenApiDocument = () => `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
