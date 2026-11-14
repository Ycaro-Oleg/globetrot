// The day plan against a real PostgreSQL: add, move, remove, ownership, the constraints and the cascade.
import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
const nextAddress = () => `198.18.0.${++addressCounter}`;

async function harness() {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    REQUIRE_VERIFIED_EMAIL: 'false',
  });
  const { app } = createServices(database.db, config, { email: createFakeEmail().port });
  const origin = config.auth.baseURL;

  async function signUp(name: string, email: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': nextAddress() },
      body: JSON.stringify({ name, email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    return {
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  const call = async (cookie: string | null, method: string, path: string, body?: unknown) => {
    const response = await app.request(`${origin}${path}`, {
      method,
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: (await response.json()) as Record<string, unknown> };
  };
  async function tripFor(cookie: string, extra: Record<string, unknown> = {}) {
    const { json } = await call(cookie, 'POST', '/v1/trips', { title: 'Japan 2027', ...extra });
    return json.id as string;
  }
  return { database, signUp, call, tripFor };
}

type Plan = {
  places: { id: string; name: string; day: number | null; destinationId: string | null }[];
};
const stop = (name: string, nights: number) => ({
  placeKey: `test:${name}`,
  name,
  latitude: 35,
  longitude: 135,
  nights,
});

describe('day plan against a real database', () => {
  it('adds places to "No day", moves them between days and keeps the order, then removes one', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    const route = await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, {
      destinations: [stop('Tokyo', 2), stop('Kyoto', 1)],
    });
    const tokyo = (route.json.destinations as { id: string }[])[0]!.id;
    const base = `/v1/trips/${id}/day-places`;

    expect(((await call(ana.cookie, 'GET', base)).json as unknown as Plan).places).toEqual([]);
    for (const name of ['Senso-ji', 'Shibuya Crossing']) {
      const added = await call(ana.cookie, 'POST', base, {
        name,
        destinationId: tokyo,
        minutes: 90,
      });
      expect(added.response.status).toBe(201);
    }
    const plan = (await call(ana.cookie, 'GET', base)).json as unknown as Plan;
    const [first, second] = plan.places;
    await call(ana.cookie, 'PATCH', `${base}/${first!.id}`, { day: 1 });
    const moved = await call(ana.cookie, 'PATCH', `${base}/${second!.id}`, {
      day: 1,
      beforeId: first!.id,
    });
    expect(moved.response.status).toBe(200);
    expect((moved.json as unknown as Plan).places.map((p) => [p.name, p.day])).toEqual([
      ['Shibuya Crossing', 1],
      ['Senso-ji', 1],
    ]);
    const outOfRange = await call(ana.cookie, 'PATCH', `${base}/${first!.id}`, { day: 9 });
    expect(outOfRange.response.status).toBe(422);
    const removed = await call(ana.cookie, 'DELETE', `${base}/${first!.id}`);
    expect((removed.json as unknown as Plan).places).toHaveLength(1);
  });

  it('answers "not found" for another user, refuses bad input and cascades with the trip', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');
    const id = await tripFor(ana.cookie);
    const base = `/v1/trips/${id}/day-places`;
    const added = await call(ana.cookie, 'POST', base, { name: 'Onsen', minutes: 120 });
    const placeId = (added.json as unknown as Plan).places[0]!.id;
    expect((await call(bruno.cookie, 'GET', base)).response.status).toBe(404);
    expect((await call(bruno.cookie, 'DELETE', `${base}/${placeId}`)).response.status).toBe(404);
    expect(
      (await call(ana.cookie, 'POST', base, { name: ' ', minutes: 120 })).response.status,
    ).toBe(422);
    expect((await call(ana.cookie, 'POST', base, { name: 'X', minutes: 5 })).response.status).toBe(
      422,
    );
    expect((await call(null, 'GET', base)).response.status).toBe(401);
    // The database refuses what the API would never send.
    await expect(
      database.db.insert(schema.tripPlace).values({
        id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d55',
        tripId: id,
        name: 'Too long a visit',
        minutes: 9999,
        position: 1,
      }),
    ).rejects.toThrow();
  });

  it('suggests built-in ideas for a popular city without the provider, and leaves out what is planned', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const tripId = await tripFor(ana.cookie);
    const { json } = await call(ana.cookie, 'PUT', `/v1/trips/${tripId}/destinations`, {
      destinations: [stop('Tokyo', 3)],
    });
    const stopId = (json.destinations as { id: string }[])[0]!.id;
    await call(ana.cookie, 'POST', `/v1/trips/${tripId}/day-places`, {
      name: 'Shibuya Crossing',
      destinationId: stopId,
      minutes: 60,
    });
    const ideas = await call(ana.cookie, 'GET', `/v1/trips/${tripId}/day-ideas?language=en`);
    expect(ideas.response.status).toBe(200);
    const first = (
      ideas.json.stops as { stopId: string; source: string; ideas: { name: string }[] }[]
    )[0]!;
    expect(first).toMatchObject({ stopId, source: 'built-in' });
    expect(first.ideas.map((idea) => idea.name)).toContain('Senso-ji Temple');
    expect(first.ideas.map((idea) => idea.name)).not.toContain('Shibuya Crossing');
  });
});
