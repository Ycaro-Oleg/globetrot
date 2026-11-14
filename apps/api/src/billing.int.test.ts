// Plans and Pip credits against a real PostgreSQL: the trial from sign-up, read-only after it, a plan opening it
// again, the active-trip limit, bought credits applied once, and checkout while payments are off (ADR-0019).
import { randomBytes } from 'node:crypto';
import { createBillingRepository, schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { eq, sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
const nextAddress = () => `198.18.4.${++addressCounter}`;

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
  async function signUp(email: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': nextAddress() },
      body: JSON.stringify({ name: 'Ana', email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { user: { id: string } };
    return {
      id: json.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  const call = async (cookie: string, method: string, path: string, body?: unknown) => {
    const response = await app.request(`${origin}${path}`, {
      method,
      headers: {
        origin,
        cookie,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
  };
  return { db: database.db, signUp, call };
}

describe('billing against a real database', () => {
  it('starts a 7-day trial at sign-up, turns read-only after it, and opens again with a plan', async () => {
    const { db, signUp, call } = await harness();
    const ana = await signUp('ana@example.com');
    const billing = await call(ana.cookie, 'GET', '/v1/me/billing');
    expect(billing.status).toBe(200);
    expect(billing.json).toMatchObject({ access: 'trial', readOnly: false, trialDaysLeft: 7 });

    // Eight days ago.
    await db
      .update(schema.user)
      .set({ createdAt: sql`now() - interval '8 days'` })
      .where(eq(schema.user.id, ana.id));
    const refused = await call(ana.cookie, 'POST', '/v1/trips', { title: 'Lisbon' });
    expect(refused.status).toBe(402);
    expect(refused.json.code).toBe('PLAN_REQUIRED');
    expect((await call(ana.cookie, 'GET', '/v1/trips')).status).toBe(200);
    expect((await call(ana.cookie, 'GET', '/v1/me/billing')).json.readOnly).toBe(true);

    await createBillingRepository(db).saveSubscription(
      ana.id,
      {
        plan: 'explorer',
        interval: 'month',
        status: 'active',
        startedAt: new Date(Date.now() - 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86_400_000),
        providerCustomerId: 'cus_test',
        providerSubscriptionId: 'sub_test',
      },
      new Date(),
    );
    expect((await call(ana.cookie, 'POST', '/v1/trips', { title: 'Lisbon' })).status).toBe(201);
    expect((await call(ana.cookie, 'GET', '/v1/me/billing')).json).toMatchObject({
      access: 'explorer',
      credits: { monthly: 100 },
    });
  });

  it('applies bought credits once per payment and sums the ledger', async () => {
    const { db, signUp } = await harness();
    const ana = await signUp('ana@example.com');
    const repo = createBillingRepository(db);
    const line = {
      userId: ana.id,
      delta: 200,
      reason: 'top-up' as const,
      ref: 'pi_1',
      createdAt: new Date(),
    };
    expect(await repo.addCredits({ ...line, id: '01900000-0000-7000-8000-000000000001' })).toBe(
      true,
    );
    expect(await repo.addCredits({ ...line, id: '01900000-0000-7000-8000-000000000002' })).toBe(
      false,
    );
    await repo.addCredits({
      ...line,
      id: '01900000-0000-7000-8000-000000000003',
      delta: -1,
      reason: 'pip',
      ref: null,
    });
    expect((await repo.findAccount(ana.id))?.topUpBalance).toBe(199);
  });

  it('keeps 10 active trips in the trial', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('ana@example.com');
    for (let n = 0; n < 10; n++) {
      expect((await call(ana.cookie, 'POST', '/v1/trips', { title: `Trip ${n}` })).status).toBe(
        201,
      );
    }
    const refused = await call(ana.cookie, 'POST', '/v1/trips', { title: 'One more' });
    expect(refused.status).toBe(402);
    expect(refused.json.code).toBe('TRIP_LIMIT_REACHED');
  });

  it('says payments are not switched on yet', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('ana@example.com');
    const checkout = await call(ana.cookie, 'POST', '/v1/me/billing/checkout', {
      item: 'explorer',
    });
    expect(checkout.status).toBe(503);
  });
});
