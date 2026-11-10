// A trip's route against a real PostgreSQL: order, replacement, ownership, constraints, cascade, audit.
import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const KYOTO = {
  placeKey: 'catalog:kyoto',
  name: 'Kyoto',
  countryCode: 'JP',
  region: 'Kansai',
  latitude: 35.01,
  longitude: 135.77,
  nights: 3,
};
const TOKYO = {
  placeKey: 'catalog:tokyo',
  name: 'Tokyo',
  latitude: 35.68,
  longitude: 139.69,
  nights: 0,
};

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
    return { cookie };
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
  async function tripFor(cookie: string) {
    const { json } = await call(cookie, 'POST', '/v1/trips', { title: 'Japan 2027' });
    return json.id as string;
  }
  return { database, signUp, call, tripFor };
}

const names = (json: Record<string, unknown>) =>
  (json.destinations as { name: string; position: number }[]).map(
    (stop) => `${stop.position}:${stop.name}`,
  );

describe('destinations against a real database', () => {
  it('stores the route in order, replaces it as a whole and clears it', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    const path = `/v1/trips/${id}/destinations`;

    expect(names((await call(ana.cookie, 'GET', path)).json)).toEqual([]);
    const first = await call(ana.cookie, 'PUT', path, { destinations: [TOKYO, KYOTO] });
    expect(names(first.json)).toEqual(['0:Tokyo', '1:Kyoto']);
    expect(names((await call(ana.cookie, 'GET', path)).json)).toEqual(['0:Tokyo', '1:Kyoto']);
    const reordered = await call(ana.cookie, 'PUT', path, { destinations: [KYOTO, TOKYO] });
    expect(names(reordered.json)).toEqual(['0:Kyoto', '1:Tokyo']);
    // The same route twice changes nothing.
    const again = await call(ana.cookie, 'PUT', path, { destinations: [KYOTO, TOKYO] });
    expect(names(again.json)).toEqual(['0:Kyoto', '1:Tokyo']);
    const one = (await call(ana.cookie, 'PUT', path, { destinations: [KYOTO] })).json
      .destinations as Record<string, unknown>[];
    expect(one[0]).toMatchObject({
      countryCode: 'JP',
      region: 'Kansai',
      latitude: 35.01,
      longitude: 135.77,
      nights: 3,
    });
    await call(ana.cookie, 'PUT', path, { destinations: [] });
    expect((await call(ana.cookie, 'GET', path)).json).toEqual({ destinations: [] });
  });

  it('keeps routes apart and answers "not found" for another user’s trip', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');
    const id = await tripFor(ana.cookie);
    const path = `/v1/trips/${id}/destinations`;
    await call(ana.cookie, 'PUT', path, { destinations: [KYOTO] });

    for (const method of ['GET', 'PUT']) {
      const { response } = await call(
        bruno.cookie,
        method,
        path,
        method === 'PUT' ? { destinations: [TOKYO] } : undefined,
      );
      expect(response.status).toBe(404);
    }
    expect(names((await call(ana.cookie, 'GET', path)).json)).toEqual(['0:Kyoto']);
    expect(await database.db.select().from(schema.destination)).toHaveLength(1);
  });

  it('audits the number of stops and no place names', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, {
      destinations: [KYOTO, TOKYO],
    });
    const events = await database.db
      .select()
      .from(schema.auditEvent)
      .where(eq(schema.auditEvent.action, 'destination.replace'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ entityType: 'trip', entityId: id, metadata: { count: 2 } });
    expect(JSON.stringify(events)).not.toContain('Kyoto');
  });

  it('refuses unsupported values even when the application is bypassed', async () => {
    const { signUp, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    for (const [column, value, constraint] of [
      ['latitude', 91, 'destination_latitude_range'],
      ['longitude', -181, 'destination_longitude_range'],
      ['nights', -1, 'destination_nights_range'],
      ['nights', 366, 'destination_nights_range'],
      ['country_code', 'jp', 'destination_country_format'],
      ['name', '', 'destination_name_length'],
      ['position', -1, 'destination_position_valid'],
    ] as const) {
      const row: Record<string, string | number> = {
        id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d9e',
        position: 0,
        place_key: 'k',
        name: 'N',
        country_code: 'JP',
        latitude: 1,
        longitude: 2,
        nights: 0,
        [column]: value,
      };
      const error = await database.pool
        .query(
          'INSERT INTO destination (id, trip_id, position, place_key, name, country_code, latitude, longitude, nights) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            row.id,
            id,
            row.position,
            row.place_key,
            row.name,
            row.country_code,
            row.latitude,
            row.longitude,
            row.nights,
          ],
        )
        .then(
          () => undefined,
          (e: unknown) => e as { constraint?: string },
        );
      expect(error?.constraint, `${column}=${value}`).toBe(constraint);
    }
  });

  it('removes the route with its trip', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    await call(ana.cookie, 'PUT', `/v1/trips/${id}/destinations`, {
      destinations: [KYOTO, TOKYO],
    });
    await database.pool.query('DELETE FROM trip WHERE id = $1', [id]);
    expect(await database.db.select().from(schema.destination)).toHaveLength(0);
  });
});
