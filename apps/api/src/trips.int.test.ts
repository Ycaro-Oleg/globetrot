import { randomBytes } from 'node:crypto';
import { createApiClient } from '@globetrot/api-client';
import { schema } from '@globetrot/db';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const KEY = 'b5f1c0de-6a3e-4c1a-9d52-3a1e8a0b7f10';
const MISSING = '00000000-0000-7000-8000-999999999999';

const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
const nextAddress = () => `192.0.2.${++addressCounter}`;

interface TripBody {
  id: string;
  title: string;
  status: string;
  currency: string;
  startDate: string | null;
}

async function harness() {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  });
  const { app } = createServices(database.db, config.auth);
  const origin = config.auth.baseURL;

  async function signUp(name: string, email: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': nextAddress() },
      body: JSON.stringify({ name, email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    return { cookie, id: ((await response.json()) as { user: { id: string } }).user.id };
  }

  const call = async (
    cookie: string | null,
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await app.request(`${origin}${path}`, {
      method,
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: (await response.json()) as Record<string, unknown> };
  };

  const [ana, bruno] = [
    await signUp('Ana', 'ana@example.com'),
    await signUp('Bruno', 'bruno@example.com'),
  ];
  const create = async (cookie: string, body: Record<string, unknown> = { title: 'Japan' }) =>
    (await call(cookie, 'POST', '/v1/trips', body)).json as unknown as TripBody;

  return { database, app, origin, call, create, ana, bruno };
}

describe('trips against a real database', () => {
  it('lets the owner create, list, read, update and archive', async () => {
    const { call, ana } = await harness();

    const created = await call(ana.cookie, 'POST', '/v1/trips', {
      title: '  Japan 2027 ',
      startDate: '2027-04-03',
    });
    expect(created.response.status).toBe(201);
    const trip = created.json as unknown as TripBody;
    expect(trip).toMatchObject({
      title: 'Japan 2027',
      currency: 'USD',
      status: 'active',
      startDate: '2027-04-03',
    });

    const list = await call(ana.cookie, 'GET', '/v1/trips');
    expect((list.json.trips as TripBody[]).map((item) => item.id)).toEqual([trip.id]);
    expect((await call(ana.cookie, 'GET', `/v1/trips/${trip.id}`)).json).toEqual(trip);

    const updated = await call(ana.cookie, 'PATCH', `/v1/trips/${trip.id}`, {
      title: 'Japan & Korea',
      startDate: null,
      currency: 'JPY',
      status: 'traveling',
    });
    expect(updated.response.status).toBe(200);
    expect(updated.json).toMatchObject({
      title: 'Japan & Korea',
      startDate: null,
      currency: 'JPY',
      status: 'traveling',
    });
    expect(Date.parse(updated.json.updatedAt as string)).toBeGreaterThanOrEqual(
      Date.parse(updated.json.createdAt as string),
    );

    const archived = await call(ana.cookie, 'POST', `/v1/trips/${trip.id}/archive`);
    expect(archived.json.status).toBe('archived');
    expect((await call(ana.cookie, 'GET', '/v1/trips')).json.trips).toEqual([]);
    const withArchived = await call(ana.cookie, 'GET', '/v1/trips?includeArchived=true');
    expect((withArchived.json.trips as TripBody[]).map((item) => item.id)).toEqual([trip.id]);

    const restored = await call(ana.cookie, 'PATCH', `/v1/trips/${trip.id}`, { status: 'active' });
    expect(restored.json.status).toBe('active');
  });

  it('shows another user 404 on read, update and archive, and never lists the trip', async () => {
    const { call, create, ana, bruno, database } = await harness();
    const trip = await create(ana.cookie);

    for (const [method, path, body] of [
      ['GET', `/v1/trips/${trip.id}`, undefined],
      ['PATCH', `/v1/trips/${trip.id}`, { title: 'Hacked' }],
      ['POST', `/v1/trips/${trip.id}/archive`, undefined],
    ] as const) {
      const theirs = await call(bruno.cookie, method, path, body);
      const missing = await call(bruno.cookie, method, path.replace(trip.id, MISSING), body);
      expect(theirs.response.status, `${method} ${path}`).toBe(404);
      expect(theirs.json).toEqual(missing.json);
    }
    expect((await call(bruno.cookie, 'GET', '/v1/trips?includeArchived=true')).json.trips).toEqual(
      [],
    );

    const [row] = await database.db.select().from(schema.trip);
    expect(row).toMatchObject({ title: 'Japan', status: 'active', ownerId: ana.id });
  });

  it('keeps the owner from the response and from client input', async () => {
    const { call, ana, bruno, database } = await harness();
    const { json } = await call(ana.cookie, 'POST', '/v1/trips', {
      title: 'Japan',
      ownerId: bruno.id,
      status: 'archived',
    });
    expect(json).not.toHaveProperty('ownerId');
    const [row] = await database.db.select().from(schema.trip);
    expect(row).toMatchObject({ ownerId: ana.id, status: 'active' });
  });

  it('rejects invalid input with stable codes and stores nothing', async () => {
    const { call, ana, database } = await harness();
    const bad = await call(ana.cookie, 'POST', '/v1/trips', {
      title: 'x'.repeat(121),
      startDate: '2027-02-30',
      currency: 'usd',
    });
    expect(bad.response.status).toBe(422);
    expect(bad.json).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await database.db.select().from(schema.trip)).toHaveLength(0);
  });

  describe('idempotency', () => {
    it('returns the same trip for a retry and the 409 problem for a different body', async () => {
      const { call, ana, database } = await harness();
      const headers = { 'idempotency-key': KEY };
      const first = await call(ana.cookie, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      const retry = await call(ana.cookie, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      expect(retry.json).toEqual(first.json);
      expect(retry.response.status).toBe(201);

      const other = await call(ana.cookie, 'POST', '/v1/trips', { title: 'Korea' }, headers);
      expect(other.response.status).toBe(409);
      expect(other.json).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });

      expect(await database.db.select().from(schema.trip)).toHaveLength(1);
      expect(await database.db.select().from(schema.auditEvent)).toHaveLength(1);
    });

    it('creates exactly one trip when the same request arrives several times at once', async () => {
      const { call, ana, database } = await harness();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          call(ana.cookie, 'POST', '/v1/trips', { title: 'Japan' }, { 'idempotency-key': KEY }),
        ),
      );
      expect(results.map((result) => result.response.status)).toEqual(Array(6).fill(201));
      expect(new Set(results.map((result) => result.json.id)).size).toBe(1);
      expect(await database.db.select().from(schema.trip)).toHaveLength(1);
    });

    it('does not share keys between users', async () => {
      const { call, ana, bruno, database } = await harness();
      const headers = { 'idempotency-key': KEY };
      const a = await call(ana.cookie, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      const b = await call(bruno.cookie, 'POST', '/v1/trips', { title: 'Japan' }, headers);
      expect(b.json.id).not.toBe(a.json.id);
      expect(await database.db.select().from(schema.trip)).toHaveLength(2);
    });
  });

  it('writes one audit event per mutation, with the actor and no personal data', async () => {
    const { call, ana, database } = await harness();
    const created = (
      await call(ana.cookie, 'POST', '/v1/trips', { title: 'Secret honeymoon in Kyoto' })
    ).json as unknown as TripBody;
    await call(ana.cookie, 'PATCH', `/v1/trips/${created.id}`, {
      title: 'Surprise anniversary',
      startDate: '2027-04-03',
      status: 'completed',
    });
    await call(ana.cookie, 'POST', `/v1/trips/${created.id}/archive`);
    await call(ana.cookie, 'POST', `/v1/trips/${created.id}/archive`); // no-op: no event
    await call(ana.cookie, 'GET', `/v1/trips/${created.id}`); // read: no event

    const events = await database.db
      .select()
      .from(schema.auditEvent)
      .orderBy(schema.auditEvent.occurredAt);
    expect(events.map((event) => event.action)).toEqual([
      'trip.create',
      'trip.update',
      'trip.archive',
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        actorKind: 'user',
        actorId: ana.id,
        entityType: 'trip',
        entityId: created.id,
      });
    }
    expect(events[1]?.metadata).toEqual({
      fields: ['title', 'startDate', 'status'],
      status: 'completed',
    });

    const everything = JSON.stringify(events);
    for (const secret of ['honeymoon', 'Kyoto', 'anniversary', '2027-04-03', 'ana@example.com']) {
      expect(everything).not.toContain(secret);
    }
  });

  it('is reachable through the generated typed client, including the idempotency header', async () => {
    const { app, origin, ana } = await harness();
    const client = createApiClient({
      baseUrl: origin,
      fetch: (request) => {
        request.headers.set('cookie', ana.cookie);
        request.headers.set('origin', origin);
        return Promise.resolve(app.fetch(request));
      },
    });

    const created = await client.POST('/v1/trips', {
      params: { header: { 'idempotency-key': KEY } },
      body: { title: 'Japan', currency: 'JPY' },
    });
    expect(created.response.status).toBe(201);
    expect(created.data).toMatchObject({ title: 'Japan', currency: 'JPY', status: 'active' });

    const id = created.data!.id;
    const read = await client.GET('/v1/trips/{id}', { params: { path: { id } } });
    expect(read.data?.id).toBe(id);

    const patched = await client.PATCH('/v1/trips/{id}', {
      params: { path: { id } },
      body: { status: 'completed' },
    });
    expect(patched.data?.status).toBe('completed');

    const list = await client.GET('/v1/trips', { params: { query: { includeArchived: 'true' } } });
    expect(list.data?.trips.map((trip) => trip.id)).toEqual([id]);

    const conflict = await client.POST('/v1/trips', {
      params: { header: { 'idempotency-key': KEY } },
      body: { title: 'Another' },
    });
    expect(conflict.error?.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const missing = await client.POST('/v1/trips/{id}/archive', {
      params: { path: { id: MISSING } },
    });
    expect(missing.error?.code).toBe('NOT_FOUND');
  });
});
