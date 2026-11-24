import { createApplication, type UserRecord } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it } from 'vitest';
import { createApp, type AuthService } from './app';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'bruno@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const KEY = 'b5f1c0de-6a3e-4c1a-9d52-3a1e8a0b7f10';
const MISSING = '00000000-0000-7000-8000-999999999999';

const auth: AuthService = {
  async handler() {
    return new Response('{}');
  },
  async getSession(headers) {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(headers.get('cookie') ?? '');
    return match?.[1] ? { userId: match[1] } : null;
  },
};

function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  const app = createApp({
    auth,
    application: createApplication(fake.ports),
    trustedOrigins: ['http://localhost:3000'],
  });
  const call = async (
    user: UserRecord | null,
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await app.request(path, {
      method,
      headers: {
        ...(user ? { cookie: `session=${user.id}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    return { response, json: (await response.json()) as Record<string, unknown> };
  };
  const createTrip = async (user: UserRecord, body: unknown = { title: 'Japan' }) => {
    const { json } = await call(user, 'POST', '/v1/trips', body);
    return json as { id: string; title: string; status: string };
  };
  return { ...fake, call, createTrip };
}

describe('/v1/trips', () => {
  it('needs a session for every route', async () => {
    const { call } = setup();
    for (const [method, path] of [
      ['GET', '/v1/trips'],
      ['POST', '/v1/trips'],
      ['GET', `/v1/trips/${MISSING}`],
      ['PATCH', `/v1/trips/${MISSING}`],
      ['POST', `/v1/trips/${MISSING}/archive`],
    ] as const) {
      const { response, json } = await call(null, method, path, method === 'GET' ? undefined : {});
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(json.code).toBe('UNAUTHENTICATED');
    }
  });

  it('creates a trip with 201 and the defaults', async () => {
    const { call } = setup();
    const { response, json } = await call(ana, 'POST', '/v1/trips', { title: ' Japan 2027 ' });
    expect(response.status).toBe(201);
    expect(json).toMatchObject({
      title: 'Japan 2027',
      currency: 'USD',
      status: 'active',
      visibility: 'private',
      startDate: null,
    });
    expect(json).not.toHaveProperty('ownerId');
  });

  it('answers invalid input with 422 problem+json and field errors', async () => {
    const { call } = setup();
    const { response, json } = await call(ana, 'POST', '/v1/trips', {
      title: '   ',
      startDate: '2027-02-30',
      currency: 'XXX',
    });
    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(json).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
    const fields = (json.errors as { field: string }[]).map((error) => error.field).sort();
    expect(fields).toEqual(['currency', 'startDate', 'title']);
  });

  it('answers a malformed JSON body with 400 problem+json', async () => {
    const { call } = setup();
    const { response, json } = await call(ana, 'POST', '/v1/trips', '{not json');
    expect(response.status).toBe(400);
    expect(json).toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('ignores a status, owner or visibility sent at creation', async () => {
    const { call, state } = setup();
    const { json } = await call(ana, 'POST', '/v1/trips', {
      title: 'T',
      status: 'archived',
      ownerId: 'u-bruno',
      visibility: 'public',
    });
    expect(json).toMatchObject({ status: 'active', visibility: 'private' });
    expect(state.trips.get(json.id as string)?.ownerId).toBe('u-ana');
  });

  describe('Idempotency-Key', () => {
    it('returns the same trip for a retry and stores one', async () => {
      const { call, state } = setup();
      const headers = { 'idempotency-key': KEY };
      const first = await call(ana, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      const retry = await call(ana, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      expect(first.response.status).toBe(201);
      expect(retry.response.status).toBe(201);
      expect(retry.json).toEqual(first.json);
      expect(state.trips.size).toBe(1);
    });

    it('answers 409 problem+json when the key is reused with another body', async () => {
      const { call, state } = setup();
      const headers = { 'idempotency-key': KEY };
      await call(ana, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      const { response, json } = await call(ana, 'POST', '/v1/trips', { title: 'Korea' }, headers);
      expect(response.status).toBe(409);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(json).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', status: 409 });
      expect(state.trips.size).toBe(1);
    });

    it('rejects a malformed key with 422', async () => {
      const { call } = setup();
      const { response, json } = await call(
        ana,
        'POST',
        '/v1/trips',
        { title: 'T' },
        {
          'idempotency-key': 'short',
        },
      );
      expect(response.status).toBe(422);
      expect(json.code).toBe('VALIDATION_FAILED');
    });
  });

  it('lists the caller’s trips, hiding archived ones unless asked', async () => {
    const { call, createTrip } = setup();
    const keep = await createTrip(ana, { title: 'Keep' });
    const drop = await createTrip(ana, { title: 'Drop' });
    await createTrip(bruno, { title: 'Bruno' });
    await call(ana, 'POST', `/v1/trips/${drop.id}/archive`, undefined);

    const plain = await call(ana, 'GET', '/v1/trips');
    expect((plain.json.trips as { id: string }[]).map((trip) => trip.id)).toEqual([keep.id]);
    const all = await call(ana, 'GET', '/v1/trips?includeArchived=true');
    expect(all.json.trips as unknown[]).toHaveLength(2);
    const bad = await call(ana, 'GET', '/v1/trips?includeArchived=maybe');
    expect(bad.response.status).toBe(422);
  });

  it('reads, updates and archives a trip', async () => {
    const { call, createTrip } = setup();
    const trip = await createTrip(ana);

    expect((await call(ana, 'GET', `/v1/trips/${trip.id}`)).json).toMatchObject({ title: 'Japan' });

    const updated = await call(ana, 'PATCH', `/v1/trips/${trip.id}`, {
      title: 'Japan & Korea',
      startDate: '2027-04-03',
      currency: 'JPY',
      status: 'traveling',
    });
    expect(updated.response.status).toBe(200);
    expect(updated.json).toMatchObject({
      title: 'Japan & Korea',
      startDate: '2027-04-03',
      currency: 'JPY',
      status: 'traveling',
    });
    const cleared = await call(ana, 'PATCH', `/v1/trips/${trip.id}`, { startDate: null });
    expect(cleared.json).toMatchObject({ startDate: null, title: 'Japan & Korea' });

    const archived = await call(ana, 'POST', `/v1/trips/${trip.id}/archive`);
    expect(archived.response.status).toBe(200);
    expect(archived.json.status).toBe('archived');
  });

  it.each([
    ['an empty body', {}],
    ['an unknown status', { status: 'deleted' }],
    ['an impossible date', { startDate: '2027-13-01' }],
    ['an empty title', { title: '' }],
  ])('rejects an update with %s with 422', async (_name, body) => {
    const { call, createTrip } = setup();
    const trip = await createTrip(ana);
    const { response, json } = await call(ana, 'PATCH', `/v1/trips/${trip.id}`, body);
    expect(response.status).toBe(422);
    expect(json.code).toBe('VALIDATION_FAILED');
  });

  it('answers 422 for an id that is not a UUID', async () => {
    const { call } = setup();
    expect((await call(ana, 'GET', '/v1/trips/not-a-uuid')).response.status).toBe(422);
  });

  it('gives another user 404 on read, update and archive, exactly like a missing trip', async () => {
    const { call, createTrip, state } = setup();
    const trip = await createTrip(ana);
    const attempts = [
      ['GET', `/v1/trips/${trip.id}`, undefined],
      ['PATCH', `/v1/trips/${trip.id}`, { title: 'Hacked' }],
      ['POST', `/v1/trips/${trip.id}/archive`, undefined],
    ] as const;
    for (const [method, path, body] of attempts) {
      const theirs = await call(bruno, method, path, body);
      const missing = await call(bruno, method, path.replace(trip.id, MISSING), body);
      expect(theirs.response.status, `${method} ${path}`).toBe(404);
      expect(theirs.json).toEqual(missing.json);
    }
    expect(state.trips.get(trip.id)).toMatchObject({ title: 'Japan', status: 'active' });
    expect((await call(bruno, 'GET', '/v1/trips')).json.trips).toEqual([]);
  });

  it('cannot be pointed at another user by headers or query', async () => {
    const { call, createTrip } = setup();
    const trip = await createTrip(ana);
    const { response } = await call(bruno, 'GET', `/v1/trips/${trip.id}?userId=u-ana`, undefined, {
      'x-user-id': 'u-ana',
      authorization: 'Bearer u-ana',
    });
    expect(response.status).toBe(404);
  });

  it('refuses a state-changing request from an untrusted origin before doing anything', async () => {
    const { call, state } = setup();
    const { response, json } = await call(
      ana,
      'POST',
      '/v1/trips',
      { title: 'T' },
      {
        origin: 'https://evil.example',
      },
    );
    expect(response.status).toBe(403);
    expect(json.code).toBe('INVALID_ORIGIN');
    expect(state.trips.size).toBe(0);
  });

  it('describes every trip operation in the OpenAPI document', async () => {
    const { call } = setup();
    const { json } = await call(null, 'GET', '/v1/openapi.json');
    const paths = json.paths as Record<string, Record<string, { operationId: string }>>;
    expect(paths['/v1/trips']?.get?.operationId).toBe('listTrips');
    expect(paths['/v1/trips']?.post?.operationId).toBe('createTrip');
    expect(paths['/v1/trips/{id}']?.get?.operationId).toBe('getTrip');
    expect(paths['/v1/trips/{id}']?.patch?.operationId).toBe('updateTrip');
    expect(paths['/v1/trips/{id}/archive']?.post?.operationId).toBe('archiveTrip');
  });
});
