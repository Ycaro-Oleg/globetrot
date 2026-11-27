import { randomBytes } from 'node:crypto';
import { createApiClient } from '@globetrot/api-client';
import { schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';

const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
const nextAddress = () => `203.0.113.${++addressCounter}`;

const DEFAULTS = {
  locale: 'en',
  currency: 'USD',
  homeCountry: null,
  nationality: null,
  timeZone: null,
  units: 'metric',
  theme: 'system',
  motion: 'full',
  homeCity: null,
  homePoint: null,
  pipOptIn: false,
  weeklyReminder: true,
  pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
  pipName: null,
};

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

  /** Signs up the way the browser does through the web proxy, including the language cookie if any. */
  async function signUp(name: string, email: string, languageCookie?: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-forwarded-for': nextAddress(),
        ...(languageCookie === undefined ? {} : { cookie: `globetrot_locale=${languageCookie}` }),
      },
      body: JSON.stringify({ name, email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    return { cookie, id: ((await response.json()) as { user: { id: string } }).user.id };
  }

  const call = async (cookie: string | null, method: string, body?: unknown) => {
    const response = await app.request(`${origin}/v1/me/preferences`, {
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

  return { database, app, origin, signUp, call };
}

describe('preferences against a real database', () => {
  it('gives a new user USD, their sign-up language, and nothing else', async () => {
    const { signUp, call, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com', 'pt-BR');
    const bruno = await signUp('Bruno', 'bruno@example.com'); // no language cookie

    expect((await call(ana.cookie, 'GET')).json).toEqual({ ...DEFAULTS, locale: 'pt-BR' });
    expect((await call(bruno.cookie, 'GET')).json).toEqual(DEFAULTS);

    // The row exists from sign-up, so a returning user is not "new" to the database.
    const rows = await database.db.select().from(schema.userPreference);
    expect(rows.map((row) => [row.userId, row.locale]).sort()).toEqual(
      [
        [ana.id, 'pt-BR'],
        [bruno.id, 'en'],
      ].sort(),
    );
  });

  it('ignores a language cookie it does not support', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com', 'fr');
    expect((await call(ana.cookie, 'GET')).json.locale).toBe('en');
  });

  it('does not let the sign-up language decide the currency or the country', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com', 'pt-BR');
    expect((await call(ana.cookie, 'GET')).json).toMatchObject({
      currency: 'USD',
      homeCountry: null,
      nationality: null,
    });
  });

  it('changes each field without touching the others', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com', 'pt-BR');
    const full = {
      locale: 'en',
      currency: 'EUR',
      homeCountry: 'BR',
      nationality: 'PT',
      timeZone: 'America/Sao_Paulo',
      units: 'imperial',
      theme: 'red-eye',
      motion: 'reduced',
      homeCity: 'São Paulo',
      homePoint: { latitude: -23.548, longitude: -46.636 },
      pipOptIn: true,
      weeklyReminder: false,
      pipLook: { hat: 'cap', outfit: 'vest', bag: 'backpack', bagColor: 'cyan' },
      pipName: 'Pipoca',
    };
    expect((await call(ana.cookie, 'PATCH', full)).json).toEqual(full);

    for (const [field, value] of [
      ['locale', 'pt-BR'],
      ['currency', 'JPY'],
      ['homeCountry', 'JP'],
      ['nationality', 'US'],
      ['timeZone', 'Asia/Tokyo'],
      ['units', 'metric'],
      ['theme', 'day'],
      ['motion', 'full'],
      ['homeCity', 'Lisbon'],
      ['homePoint', { latitude: 38.717, longitude: -9.133 }],
      ['pipOptIn', false],
      ['weeklyReminder', true],
      ['pipName', 'Globinho'],
      ['pipLook', { hat: 'none', outfit: 'scarf', bag: 'vintage', bagColor: 'pink' }],
    ] as const) {
      const before = (await call(ana.cookie, 'GET')).json;
      // A home city typed without its point must not keep the old city's point: that is the one linked field.
      const expected =
        field === 'homeCity'
          ? { ...before, homeCity: value, homePoint: null }
          : { ...before, [field]: value };
      const { json } = await call(ana.cookie, 'PATCH', { [field]: value });
      expect(json, field).toEqual(expected);
      expect((await call(ana.cookie, 'GET')).json, field).toEqual(expected);
    }

    const cleared = await call(ana.cookie, 'PATCH', {
      homeCountry: null,
      nationality: null,
      timeZone: null,
    });
    expect(cleared.json).toMatchObject({ homeCountry: null, nationality: null, timeZone: null });
    expect(cleared.json.currency).toBe('JPY');
  });

  it('stores a time zone in its canonical spelling', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    expect((await call(ana.cookie, 'PATCH', { timeZone: 'america/sao_paulo' })).json.timeZone).toBe(
      'America/Sao_Paulo',
    );
  });

  it('rejects invalid values with stable codes and changes nothing', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    for (const body of [
      { locale: 'fr' },
      { currency: 'usd' },
      { currency: 'XXX' },
      { homeCountry: 'XX' },
      { nationality: 'br' },
      { timeZone: 'Mars/Olympus' },
      { units: 'nautical' },
      { theme: 'night' },
      { motion: 'none' },
      {},
    ]) {
      const { response, json } = await call(ana.cookie, 'PATCH', body);
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect(json.code).toBe('VALIDATION_FAILED');
    }
    expect((await call(ana.cookie, 'GET')).json).toEqual(DEFAULTS);
  });

  it('keeps each user’s settings private, and cannot be aimed at another user', async () => {
    const { signUp, call, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');
    await call(bruno.cookie, 'PATCH', { currency: 'JPY', homeCountry: 'JP' });

    const sneaky = await call(ana.cookie, 'PATCH', { currency: 'EUR', userId: bruno.id });
    expect(sneaky.json.currency).toBe('EUR');

    expect((await call(bruno.cookie, 'GET')).json).toMatchObject({
      currency: 'JPY',
      homeCountry: 'JP',
    });
    expect((await call(ana.cookie, 'GET')).json).toMatchObject({
      currency: 'EUR',
      homeCountry: null,
    });
    expect((await call(null, 'GET')).response.status).toBe(401);
    expect((await call(null, 'PATCH', { currency: 'EUR' })).response.status).toBe(401);

    const [row] = await database.db
      .select()
      .from(schema.userPreference)
      .where(eq(schema.userPreference.userId, bruno.id));
    expect(row?.currency).toBe('JPY');
  });

  it('works for an account that has no row yet (the first save creates it with defaults)', async () => {
    const { signUp, call, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com', 'pt-BR');
    await database.db.delete(schema.userPreference);
    expect((await call(ana.cookie, 'GET')).json).toEqual(DEFAULTS);
    expect((await call(ana.cookie, 'PATCH', { units: 'imperial' })).json).toEqual({
      ...DEFAULTS,
      units: 'imperial',
    });
  });

  it('audits the names of the changed fields and no values', async () => {
    const { signUp, call, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    await call(ana.cookie, 'PATCH', { homeCountry: 'BR', timeZone: 'America/Sao_Paulo' });

    const events = await database.db.select().from(schema.auditEvent);
    expect(events).toEqual([
      expect.objectContaining({
        action: 'preferences.update',
        actorId: ana.id,
        entityType: 'user_preference',
        entityId: ana.id,
        metadata: { fields: ['homeCountry', 'timeZone'] },
      }),
    ]);
    expect(JSON.stringify(events)).not.toMatch(/Sao_Paulo|"BR"/);
  });

  it('is reachable through the generated typed client', async () => {
    const { app, origin, signUp } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const client = createApiClient({
      baseUrl: origin,
      fetch: (request) => {
        request.headers.set('cookie', ana.cookie);
        request.headers.set('origin', origin);
        return Promise.resolve(app.fetch(request));
      },
    });

    const patched = await client.PATCH('/v1/me/preferences', {
      body: { currency: 'BRL', homeCountry: 'BR', timeZone: null },
    });
    expect(patched.data).toMatchObject({ currency: 'BRL', homeCountry: 'BR', timeZone: null });
    const read = await client.GET('/v1/me/preferences');
    expect(read.data).toEqual(patched.data);
  });
});

describe('what the database enforces for preferences', () => {
  it('refuses unsupported values even when the application is bypassed', async () => {
    const { signUp, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    for (const [column, value, constraint] of [
      ['locale', 'fr', 'user_preference_locale_valid'],
      ['currency', 'usd', 'user_preference_currency_format'],
      ['home_country', 'br', 'user_preference_home_country_format'],
      ['nationality', 'B1', 'user_preference_nationality_format'],
      ['units', 'nautical', 'user_preference_units_valid'],
      ['theme', 'night', 'user_preference_theme_valid'],
      ['motion', 'none', 'user_preference_motion_valid'],
    ] as const) {
      const error = await database.pool
        .query(`UPDATE user_preference SET ${column} = $1 WHERE user_id = $2`, [value, ana.id])
        .then(
          () => undefined,
          (e: unknown) => e as { constraint?: string; code?: string },
        );
      expect(error?.constraint ?? error?.code, column).toBe(constraint);
    }
  });
});
