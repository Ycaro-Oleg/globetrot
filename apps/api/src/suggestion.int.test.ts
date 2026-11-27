// A trip from the landing's suggested plan against a real PostgreSQL: stops, places, the estimate and the savings
// land on a trip the caller alone can open, and a retry with the same key is the same trip.
import { randomBytes } from 'node:crypto';
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
const nextAddress = () => `198.18.1.${++addressCounter}`;

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
    return response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
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
  return { signUp, call };
}

const plan = {
  destination: 'portugal',
  likes: ['food'],
  days: 9,
  comfort: 'budget',
  currency: 'BRL',
  monthly: '1500',
  locale: 'pt-BR',
};

describe('POST /v1/trips/from-suggestion', () => {
  it('creates the planned trip for the caller only, and replays a retry with the same key', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.test');
    const bruno = await signUp('Bruno', 'bruno@example.test');

    const key = { 'idempotency-key': 'plan-portugal-0001' };
    const created = await call(ana, 'POST', '/v1/trips/from-suggestion', plan, key);
    expect(created.response.status).toBe(201);
    expect(created.json).toMatchObject({ title: 'Portugal', currency: 'BRL' });
    const tripId = created.json.id as string;

    const again = await call(ana, 'POST', '/v1/trips/from-suggestion', plan, key);
    expect(again.response.status).toBe(201);
    expect(again.json.id).toBe(tripId);

    const route = await call(ana, 'GET', `/v1/trips/${tripId}/destinations`);
    const stops = route.json.destinations as { name: string; spots: unknown[] }[];
    expect(stops.map((stop) => stop.name)[0]).toBe('Lisboa');
    expect(stops.every((stop) => stop.spots.length > 0)).toBe(true);

    const budget = await call(ana, 'GET', `/v1/trips/${tripId}/budget`);
    expect((budget.json.savings as { monthly: unknown }).monthly).toEqual({
      amount: '1500.00',
      currency: 'BRL',
    });
    expect(budget.json.guess).not.toBeNull();

    expect((await call(bruno, 'GET', `/v1/trips/${tripId}`)).response.status).toBe(404);
    expect((await call(null, 'POST', '/v1/trips/from-suggestion', plan)).response.status).toBe(401);
    expect(
      (await call(ana, 'POST', '/v1/trips/from-suggestion', { ...plan, destination: 'mars' }))
        .response.status,
    ).toBe(422);
  });
});
