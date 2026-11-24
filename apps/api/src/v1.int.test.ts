import { randomBytes } from 'node:crypto';
import { createApiClient } from '@globetrot/api-client';
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
const nextAddress = () => `198.51.100.${++addressCounter}`;

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

  /** Signs a user up through the real auth route and returns its id and session cookie. */
  async function signUp(name: string, email: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-forwarded-for': nextAddress(),
      },
      body: JSON.stringify({ name, email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    return { id: body.user.id, cookie };
  }

  const get = (path: string, headers: Record<string, string> = {}) =>
    app.request(`${origin}${path}`, { headers });

  return { database, app, origin, signUp, get };
}

describe('GET /v1/me against a real database', () => {
  it('refuses an anonymous caller with problem+json', async () => {
    const { get } = await harness();
    const response = await get('/v1/me');
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('returns only the caller’s id, email, name and verification flag', async () => {
    const { signUp, get } = await harness();
    const ana = await signUp('Ana', 'Ana@Example.com');
    const response = await get('/v1/me', { cookie: ana.cookie });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: ana.id,
      email: 'ana@example.com',
      name: 'Ana',
      emailVerified: false,
    });
  });

  it('shows each of two users only their own data, whatever else the request says', async () => {
    const { signUp, get } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');

    const asAna = await (await get('/v1/me', { cookie: ana.cookie })).json();
    const asBruno = await (await get('/v1/me', { cookie: bruno.cookie })).json();
    expect(asAna).toMatchObject({ id: ana.id, email: 'ana@example.com' });
    expect(asBruno).toMatchObject({ id: bruno.id, email: 'bruno@example.com' });

    // Ana tries to be Bruno through every channel a client controls. None of it changes who she is.
    const spoofed = await get(`/v1/me?userId=${bruno.id}&actor=${bruno.id}`, {
      cookie: ana.cookie,
      'x-user-id': bruno.id,
      'x-actor': JSON.stringify({ kind: 'user', userId: bruno.id }),
      authorization: `Bearer ${bruno.id}`,
    });
    expect(await spoofed.json()).toMatchObject({ id: ana.id, email: 'ana@example.com' });

    // Without a session those same headers are worth nothing.
    const headersOnly = await get(`/v1/me?userId=${bruno.id}`, {
      'x-user-id': bruno.id,
      authorization: `Bearer ${bruno.id}`,
    });
    expect(headersOnly.status).toBe(401);
  });

  it('rejects a forged or tampered session cookie', async () => {
    const { signUp, get } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const [name, value = ''] = ana.cookie.split('=');
    for (const cookie of [
      `${name}=${value.slice(0, -4)}AAAA`,
      `${name}=${ana.id}`,
      `${name}=forged.value`,
    ]) {
      expect((await get('/v1/me', { cookie })).status).toBe(401);
    }
  });

  it('ends with the session: after sign-out the same cookie no longer works', async () => {
    const { signUp, get, app, origin } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    expect((await get('/v1/me', { cookie: ana.cookie })).status).toBe(200);
    await app.request(`${origin}/api/auth/sign-out`, {
      method: 'POST',
      headers: { origin, cookie: ana.cookie, 'content-type': 'application/json' },
      body: '{}',
    });
    expect((await get('/v1/me', { cookie: ana.cookie })).status).toBe(401);
  });

  it('is reachable through the generated typed client', async () => {
    const { signUp, app, origin } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const client = createApiClient({
      baseUrl: origin,
      fetch: (request) => {
        request.headers.set('cookie', ana.cookie);
        return Promise.resolve(app.fetch(request));
      },
    });

    const { data, error, response } = await client.GET('/v1/me');

    expect(response.status).toBe(200);
    expect(error).toBeUndefined();
    expect(data).toEqual({
      id: ana.id,
      email: 'ana@example.com',
      name: 'Ana',
      emailVerified: false,
    });

    const anonymous = await createApiClient({
      baseUrl: origin,
      fetch: (request) => Promise.resolve(app.fetch(request)),
    }).GET('/v1/me');
    expect(anonymous.data).toBeUndefined();
    expect(anonymous.error?.code).toBe('UNAUTHENTICATED');
  });

  it('serves the same contract that is committed', async () => {
    const { get } = await harness();
    const live = await (await get('/v1/openapi.json')).json();
    const { buildOpenApiDocument } = await import('./openapi');
    expect(live).toEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())));
  });
});
