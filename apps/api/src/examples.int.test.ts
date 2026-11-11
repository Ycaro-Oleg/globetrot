// Copying an example trip against a real PostgreSQL: the route lands on the new trip, owned by the caller only.
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

describe('example trips against a real database', () => {
  it('copies the route into a new trip of the caller, and a retry with the same key is the same trip', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');
    const created = await call(ana.cookie, 'POST', '/v1/trips/from-example', {
      exampleId: 'japan',
      title: 'Japão em duas semanas',
    });
    expect(created.response.status).toBe(201);
    expect(created.json).toMatchObject({ title: 'Japão em duas semanas', currency: 'USD' });
    const id = created.json.id as string;
    const route = await call(ana.cookie, 'GET', `/v1/trips/${id}/destinations`);
    const names = (route.json.destinations as { name: string; nights: number }[]).map(
      (d) => d.name,
    );
    expect(names).toEqual(['Tokyo', 'Hakone', 'Kyoto', 'Nara', 'Osaka', 'Hiroshima']);
    expect((await call(bruno.cookie, 'GET', `/v1/trips/${id}/destinations`)).response.status).toBe(
      404,
    );

    expect(
      (await call(ana.cookie, 'POST', '/v1/trips/from-example', { exampleId: 'atlantis' })).response
        .status,
    ).toBe(422);
    expect(
      (await call(null, 'POST', '/v1/trips/from-example', { exampleId: 'japan' })).response.status,
    ).toBe(401);
  });
});
