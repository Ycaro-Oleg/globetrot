import { createApplication, type UserRecord } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it } from 'vitest';
import { createApp, type AuthService } from './app';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const auth: AuthService = {
  async handler() {
    return new Response('{}');
  },
  async getSession(headers) {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(headers.get('cookie') ?? '');
    return match?.[1] ? { userId: match[1] } : null;
  },
};

const STOP = {
  placeKey: 'catalog:kyoto',
  name: 'Kyoto',
  countryCode: 'JP',
  latitude: 35.01,
  longitude: 135.77,
  nights: 3,
};

async function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  const application = createApplication(fake.ports);
  const app = createApp({ auth, application, trustedOrigins: ['http://localhost:3000'] });
  const trip = await application.createTrip.execute(
    { kind: 'user', userId: ana.id },
    { title: 'Japan 2027' },
  );
  const call = async (user: UserRecord | null, method: string, tripId: string, body?: unknown) => {
    const response = await app.request(`/v1/trips/${tripId}/destinations`, {
      method,
      headers: {
        ...(user ? { cookie: `session=${user.id}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: (await response.json()) as Record<string, unknown> };
  };
  return { ...fake, trip, call };
}

describe('/v1/trips/{id}/destinations', () => {
  it('needs a session', async () => {
    const { call, trip } = await setup();
    for (const method of ['GET', 'PUT']) {
      const { response, json } = await call(
        null,
        method,
        trip.id,
        method === 'PUT' ? { destinations: [] } : undefined,
      );
      expect(response.status).toBe(401);
      expect(json.code).toBe('UNAUTHENTICATED');
    }
  });

  it('saves a route and reads it back in order', async () => {
    const { call, trip } = await setup();
    const saved = await call(ana, 'PUT', trip.id, {
      destinations: [STOP, { ...STOP, placeKey: 'catalog:tokyo', name: 'Tokyo' }],
    });
    expect(saved.response.status).toBe(200);
    const read = await call(ana, 'GET', trip.id);
    expect(read.response.status).toBe(200);
    expect((read.json.destinations as { name: string }[]).map((stop) => stop.name)).toEqual([
      'Kyoto',
      'Tokyo',
    ]);
  });

  it('is "not found" for someone else’s trip, the same as for a missing one', async () => {
    const { call, trip } = await setup();
    const theirs = await call(bruno, 'GET', trip.id);
    const missing = await call(bruno, 'GET', '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d9e');
    expect(theirs.response.status).toBe(404);
    expect(missing.response.status).toBe(404);
    expect(theirs.json).toEqual(missing.json);
    expect((await call(bruno, 'PUT', trip.id, { destinations: [STOP] })).response.status).toBe(404);
  });

  it.each([
    ['a bad trip id', 'not-a-uuid', { destinations: [] }],
    ['a stop with a bad latitude', undefined, { destinations: [{ ...STOP, latitude: 200 }] }],
    ['no list', undefined, {}],
  ])('rejects %s with 422 problem+json', async (_name, id, body) => {
    const { call, trip } = await setup();
    const { response, json } = await call(ana, 'PUT', id ?? trip.id, body);
    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(json.code).toBe('VALIDATION_FAILED');
  });
});
