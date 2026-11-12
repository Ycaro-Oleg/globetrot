// Money against a real PostgreSQL: exact amounts, conversion provenance, ownership, constraints, cascade, the lock.
import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const COST = {
  description: 'Flights to Tokyo',
  category: 'flights',
  status: 'estimate',
  amount: '1250.00',
  currency: 'USD',
};

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

describe('budget against a real database', () => {
  it('stores costs exactly, converts with provenance, and totals in the trip’s currency', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie, { startDate: '2027-04-03' });
    const base = `/v1/trips/${id}`;

    expect((await call(ana.cookie, 'POST', `${base}/expenses`, COST)).response.status).toBe(201);
    const foreign = await call(ana.cookie, 'POST', `${base}/expenses`, {
      ...COST,
      description: 'Ryokan',
      category: 'stay',
      status: 'confirmed',
      amount: '150000',
      currency: 'JPY',
      fxRate: '0.0065',
      fxAsOf: '2026-11-01',
    });
    expect(foreign.response.status).toBe(201);
    expect(foreign.json).toMatchObject({
      original: { amount: '150000', currency: 'JPY' },
      inTripCurrency: { amount: '975.00', currency: 'USD' },
      fx: { rate: '0.0065', source: 'manual', asOf: '2026-11-01' },
    });

    // An amount far beyond a JavaScript float's exact range stays exact (stored as bigint minor units).
    const huge = await call(ana.cookie, 'POST', `${base}/expenses`, {
      ...COST,
      description: 'Private jet',
      amount: '123456789012345.99',
    });
    expect(huge.json).toMatchObject({ original: { amount: '123456789012345.99' } });

    const budget = (await call(ana.cookie, 'GET', `${base}/budget`)).json as {
      total: unknown;
      savings: { status: string };
    };
    expect(budget.total).toEqual({ amount: '123456789014570.99', currency: 'USD' });
    expect(budget.savings.status).toBe('saving');
    expect((await call(ana.cookie, 'GET', `${base}/expenses`)).json.expenses).toHaveLength(3);
  });

  it('keeps savings and answers the plan, and the currency is locked while there is money', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie, { startDate: '2027-04-03' });
    const base = `/v1/trips/${id}`;
    // no money yet: the currency may change
    expect((await call(ana.cookie, 'PATCH', base, { currency: 'EUR' })).json.currency).toBe('EUR');
    await call(ana.cookie, 'POST', `${base}/expenses`, {
      ...COST,
      currency: 'EUR',
      amount: '2000',
    });
    const plan = (
      await call(ana.cookie, 'PUT', `${base}/savings`, { saved: '500', monthly: '300' })
    ).json as { savings: unknown };
    expect(plan.savings).toMatchObject({
      saved: { amount: '500.00', currency: 'EUR' },
      left: { amount: '1500.00' },
      monthsNeeded: 5,
    });
    // savings are partial: the monthly amount alone keeps what was saved
    const faster = (await call(ana.cookie, 'PUT', `${base}/savings`, { monthly: '500' })).json as {
      savings: unknown;
    };
    expect(faster.savings).toMatchObject({ saved: { amount: '500.00' }, monthsNeeded: 3 });
    const locked = await call(ana.cookie, 'PATCH', base, { currency: 'USD' });
    expect(locked.response.status).toBe(422);
    expect(JSON.stringify(locked.json)).toContain('currency_locked');
  });

  it('keeps costs apart and answers "not found" for another user’s trip', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');
    const id = await tripFor(ana.cookie);
    const created = await call(ana.cookie, 'POST', `/v1/trips/${id}/expenses`, COST);
    const costId = created.json.id as string;
    for (const [method, path, body] of [
      ['GET', `/v1/trips/${id}/budget`, undefined],
      ['GET', `/v1/trips/${id}/expenses`, undefined],
      ['POST', `/v1/trips/${id}/expenses`, COST],
      ['PUT', `/v1/trips/${id}/expenses/${costId}`, COST],
      ['DELETE', `/v1/trips/${id}/expenses/${costId}`, undefined],
      ['PUT', `/v1/trips/${id}/savings`, { saved: '1' }],
    ] as const) {
      expect(
        (await call(bruno.cookie, method, path, body)).response.status,
        `${method} ${path}`,
      ).toBe(404);
    }
    expect(await database.db.select().from(schema.expense)).toHaveLength(1);
  });

  it('audits categories and never amounts or descriptions', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    await call(ana.cookie, 'POST', `/v1/trips/${id}/expenses`, COST);
    await call(ana.cookie, 'PUT', `/v1/trips/${id}/savings`, { saved: '777' });
    const events = await database.db.select().from(schema.auditEvent);
    const ours = events.filter(
      (event) => event.action.startsWith('expense') || event.action.startsWith('savings'),
    );
    expect(ours.map((event) => event.action)).toEqual(
      expect.arrayContaining(['expense.create', 'savings.update']),
    );
    // Only what was recorded about the change: ids and timestamps are random and may contain any digits.
    const text = JSON.stringify(ours.map((event) => [event.action, event.metadata]));
    for (const personal of ['1250', '777', 'Tokyo']) expect(text).not.toContain(personal);
  });

  it('refuses impossible rows even when the application is bypassed, and removes costs with their trip', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    const insert = (overrides: Record<string, unknown>) => {
      const row = {
        id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d9e',
        category: 'flights',
        status: 'estimate',
        description: 'x',
        amount_minor: 100,
        currency: 'USD',
        trip_amount_minor: 100,
        fx_rate: null,
        fx_source: null,
        fx_as_of: null,
        ...overrides,
      };
      return database.pool
        .query(
          'INSERT INTO expense (id, trip_id, category, status, description, amount_minor, currency, trip_amount_minor, fx_rate, fx_source, fx_as_of) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [
            row.id,
            id,
            row.category,
            row.status,
            row.description,
            row.amount_minor,
            row.currency,
            row.trip_amount_minor,
            row.fx_rate,
            row.fx_source,
            row.fx_as_of,
          ],
        )
        .then(
          () => undefined,
          (e: unknown) => e as { constraint?: string },
        );
    };
    expect((await insert({ category: 'fun' }))?.constraint).toBe('expense_category_valid');
    expect((await insert({ status: 'maybe' }))?.constraint).toBe('expense_status_valid');
    expect((await insert({ amount_minor: 0 }))?.constraint).toBe('expense_amount_positive');
    expect((await insert({ trip_amount_minor: -5 }))?.constraint).toBe('expense_amount_positive');
    expect((await insert({ currency: 'usd' }))?.constraint).toBe('expense_currency_format');
    expect((await insert({ description: ' padded ' }))?.constraint).toBe(
      'expense_description_length',
    );
    // a rate with no source and no day is half a provenance
    expect((await insert({ fx_rate: '0.0065' }))?.constraint).toBe('expense_fx_provenance');
    expect(
      (await insert({ fx_rate: 'abc', fx_source: 'manual', fx_as_of: '2026-11-01' }))?.constraint,
    ).toBe('expense_fx_provenance');
    expect(await insert({})).toBeUndefined();
    await database.pool.query(
      'INSERT INTO trip_savings (trip_id, saved_minor, monthly_minor) VALUES ($1, 0, 0)',
      [id],
    );
    const negative = await database.pool
      .query('UPDATE trip_savings SET saved_minor = -1 WHERE trip_id = $1', [id])
      .then(
        () => undefined,
        (e: unknown) => e as { constraint?: string },
      );
    expect(negative?.constraint).toBe('trip_savings_not_negative');

    await database.pool.query('DELETE FROM trip WHERE id = $1', [id]);
    expect(await database.db.select().from(schema.expense)).toHaveLength(0);
    expect(await database.db.select().from(schema.tripSavings)).toHaveLength(0);
    void call;
  });
});
