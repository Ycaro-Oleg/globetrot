// The board's server side against a real PostgreSQL: notes and legs on stops, and place search behind the API.
import { randomBytes } from 'node:crypto';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import type { GeocodingPort } from '@globetrot/application';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
const nextAddress = () => `198.18.0.${++addressCounter}`;

async function harness(geocoding?: GeocodingPort) {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    REQUIRE_VERIFIED_EMAIL: 'false',
  });
  const { app } = createServices(database.db, config, {
    email: createFakeEmail().port,
    ...(geocoding ? { geocoding } : {}),
  });
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

const KYOTO = {
  key: 'geoapify:kyoto',
  name: 'Kyoto',
  countryCode: 'JP',
  region: 'Kansai',
  latitude: 35.0116,
  longitude: 135.7681,
  attribution: '© OpenStreetMap contributors · Geoapify',
};

describe('the board against a real database', () => {
  it('stores a note and the leg to the next stop, and drops the leg on the last stop', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const trip = await call(ana.cookie, 'POST', '/v1/trips', { title: 'Japan' });
    const id = trip.json.id as string;
    const stop = (name: string, extra: Record<string, unknown>) => ({
      placeKey: `test:${name}`,
      name,
      latitude: 35,
      longitude: 135,
      nights: 2,
      ...extra,
    });
    const saved = await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, {
      destinations: [
        stop('Tokyo', { note: 'Ramen in Shinjuku', legMode: 'train' }),
        stop('Kyoto', { legMode: 'boat' }),
      ],
    });
    expect(saved.response.status).toBe(200);
    const listed = await call(ana.cookie, 'GET', `/v1/trips/${id}/destinations`);
    expect(
      (listed.json.destinations as { note: string | null; legMode: string | null }[]).map((d) => [
        d.note,
        d.legMode,
      ]),
    ).toEqual([
      ['Ramen in Shinjuku', 'train'],
      [null, null],
    ]);
    const bad = await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, {
      destinations: [stop('Tokyo', { legMode: 'rocket' }), stop('Kyoto', {})],
    });
    expect(bad.response.status).toBe(422);
  });

  it('searches places through the port, needs a session, and falls back to the city index when the provider is down', async () => {
    let down = false;
    const geocoding: GeocodingPort = {
      search: async () => (down ? null : [KYOTO]),
      reverse: async () => (down ? undefined : KYOTO),
      sights: async () => null,
    };
    const { signUp, call } = await harness(geocoding);
    const ana = await signUp('Ana', 'ana@example.com');
    const found = await call(ana.cookie, 'GET', '/v1/places/search?query=kyo&language=pt-BR');
    expect(found.response.status).toBe(200);
    expect(found.json).toEqual({ places: [KYOTO] });
    const point = await call(ana.cookie, 'GET', '/v1/places/reverse?latitude=35&longitude=135.7');
    expect(point.json).toEqual({ place: KYOTO });
    expect((await call(ana.cookie, 'GET', '/v1/places/search?query=k')).response.status).toBe(422);
    expect((await call(null, 'GET', '/v1/places/search?query=kyoto')).response.status).toBe(401);
    down = true;
    // With the provider down, cities still answer from the built-in index (in Portuguese when known); a village
    // the index does not have is a 503.
    const fallback = await call(ana.cookie, 'GET', '/v1/places/search?query=kyoto&language=pt-BR');
    expect(fallback.response.status).toBe(200);
    expect((fallback.json.places as unknown[])[0]).toMatchObject({
      name: 'Quioto',
      countryCode: 'JP',
      attribution: 'GeoNames',
    });
    // The city list for onboarding: no provider at all, accents ignored, biggest first.
    const cities = await call(ana.cookie, 'GET', '/v1/places/cities?query=fortal&language=pt-BR');
    expect((cities.json.places as unknown[])[0]).toMatchObject({
      name: 'Fortaleza',
      region: 'Ceará',
      countryCode: 'BR',
    });
    expect((await call(null, 'GET', '/v1/places/cities?query=paris')).response.status).toBe(401);
    expect(
      (await call(ana.cookie, 'GET', '/v1/places/search?query=Shirakawa-go')).response.status,
    ).toBe(503);
  });

  it('stores spots, todos and visited, stamps one visa per country and lists only the caller’s visas', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const leo = await signUp('Leo', 'leo@example.com');
    const id = await tripFor(ana.cookie);
    const stop = (name: string, extra: Record<string, unknown>) => ({
      placeKey: `test:${name}`,
      name,
      countryCode: 'JP',
      latitude: 35,
      longitude: 135,
      ...extra,
    });
    const route = (visited: boolean) => ({
      destinations: [
        stop('Tokyo', {
          visited,
          spots: [{ name: 'Senso-ji', latitude: 35.7148, longitude: 139.7967, done: true }],
          todos: [{ text: 'Buy a Suica card' }],
        }),
        stop('Kyoto', { visited }),
      ],
    });

    const first = await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, route(true));
    expect(first.response.status).toBe(200);
    expect(first.json.stampedVisas).toMatchObject([{ countryCode: 'JP', city: 'Tokyo' }]);
    const again = await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, route(true));
    expect(again.json.stampedVisas).toEqual([]);

    const listed = await call(ana.cookie, 'GET', `/v1/trips/${id}/destinations`);
    expect((listed.json.destinations as unknown[])[0]).toMatchObject({
      visited: true,
      // Sent without a kind, stored and read back as a sight.
      spots: [
        { name: 'Senso-ji', kind: 'sight', latitude: 35.7148, longitude: 139.7967, done: true },
      ],
      todos: [{ text: 'Buy a Suica card', done: false }],
    });

    // A visa is a souvenir: un-visiting the stops keeps it.
    await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, route(false));
    const mine = await call(ana.cookie, 'GET', '/v1/visas');
    expect((mine.json.visas as { countryCode: string }[]).map((v) => v.countryCode)).toEqual([
      'JP',
    ]);
    expect((await call(leo.cookie, 'GET', '/v1/visas')).json.visas).toEqual([]);
    expect((await call(null, 'GET', '/v1/visas')).response.status).toBe(401);
  });
});
