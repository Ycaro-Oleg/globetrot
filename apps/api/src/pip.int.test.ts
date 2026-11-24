// Pip against a real PostgreSQL with a fake model: proposals are stored, applied in one transaction, undone,
// and the model only ever sees the trip's plan.
import { randomBytes } from 'node:crypto';
import type { AiPort } from '@globetrot/application';
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

let counter = 0;
async function harness(answer: string | null) {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    REQUIRE_VERIFIED_EMAIL: 'false',
  });
  const sent: string[] = [];
  const ai: AiPort = {
    async completeJson(input) {
      sent.push(input.user);
      return answer === null
        ? null
        : { content: answer, provider: 'fake', model: 'fake', inputTokens: 100, outputTokens: 20 };
    },
  };
  const { app } = createServices(database.db, config, { email: createFakeEmail().port, ai });
  const origin = config.auth.baseURL;
  async function signUp(name: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-forwarded-for': `198.18.9.${++counter}`,
      },
      body: JSON.stringify({ name, email: `pip${counter}@example.test`, password: PASSWORD }),
    });
    return response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
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
  return { signUp, call, sent };
}

const ANSWER = JSON.stringify({
  summary: 'Slow down in Kyoto.',
  changes: [
    { kind: 'setNights', stopId: 's2', nights: 4, reason: 'More time' },
    {
      kind: 'addChecklistItem',
      group: 'documents',
      label: 'Check entry rules on the official site',
    },
    { kind: 'addExpense', category: 'food', description: 'Meals (estimate)', amount: '200' },
  ],
});

describe('Pip (PostgreSQL)', () => {
  it('proposes, applies the chosen changes and undoes them', async () => {
    const { signUp, call, sent } = await harness(ANSWER);
    const ana = await signUp('Ana Secret');
    const { json: trip } = await call(ana, 'POST', '/v1/trips', { title: 'Japan 2027' });
    const id = trip.id as string;
    await call(ana, 'PUT', `/v1/trips/${id}/destinations`, {
      destinations: [
        {
          placeKey: 't:tyo',
          name: 'Tokyo',
          countryCode: 'JP',
          latitude: 35.68,
          longitude: 139.69,
          nights: 3,
        },
        {
          placeKey: 't:kyo',
          name: 'Kyoto',
          countryCode: 'JP',
          latitude: 35.01,
          longitude: 135.77,
          nights: 2,
        },
      ],
    });
    const asked = await call(ana, 'POST', `/v1/trips/${id}/pip/proposals`, {
      request: 'Slower please',
    });
    expect(asked.status).toBe(201);
    expect(asked.json).toMatchObject({
      status: 'proposed',
      currency: 'USD',
      summary: 'Slow down in Kyoto.',
    });
    expect((asked.json.changes as unknown[]).length).toBe(3);
    expect(sent[0]).toContain('Kyoto');
    expect(sent[0]).not.toContain('Ana Secret');
    expect(sent[0]).not.toContain('example.test');

    const pid = asked.json.id as string;
    const applied = await call(ana, 'POST', `/v1/pip/proposals/${pid}/apply`, { include: [0, 2] });
    expect(applied.json).toMatchObject({ status: 'applied', applied: [0, 2], undoable: true });
    const stops = await call(ana, 'GET', `/v1/trips/${id}/destinations`);
    expect((stops.json.destinations as { nights: number }[]).map((s) => s.nights)).toEqual([3, 4]);
    const expenses = await call(ana, 'GET', `/v1/trips/${id}/expenses`);
    expect(expenses.json.expenses).toMatchObject([{ status: 'estimate' }]);
    expect((await call(ana, 'GET', `/v1/trips/${id}/checklist`)).json.items).toEqual([]);

    const undone = await call(ana, 'POST', `/v1/pip/proposals/${pid}/undo`);
    expect(undone.json.status).toBe('undone');
    const back = await call(ana, 'GET', `/v1/trips/${id}/destinations`);
    expect((back.json.destinations as { nights: number }[]).map((s) => s.nights)).toEqual([3, 2]);
    expect((await call(ana, 'GET', `/v1/trips/${id}/expenses`)).json.expenses).toEqual([]);
    const list = await call(ana, 'GET', `/v1/trips/${id}/pip/proposals`);
    expect((list.json.proposals as unknown[]).length).toBe(1);
  });

  it('answers 503 when the model is not available, and 404 for someone else’s proposal', async () => {
    const off = await harness(null);
    const ana = await off.signUp('Ana');
    const { json: trip } = await off.call(ana, 'POST', '/v1/trips', { title: 'Japan' });
    const asked = await off.call(ana, 'POST', `/v1/trips/${trip.id as string}/pip/proposals`, {
      request: 'Help',
    });
    expect(asked.status).toBe(503);

    const on = await harness(ANSWER);
    const a = await on.signUp('Ana');
    const b = await on.signUp('Leo');
    const { json: t } = await on.call(a, 'POST', '/v1/trips', { title: 'Japan' });
    const { json: p } = await on.call(a, 'POST', `/v1/trips/${t.id as string}/pip/proposals`, {
      request: 'Help',
    });
    expect((await on.call(b, 'POST', `/v1/pip/proposals/${p.id as string}/discard`)).status).toBe(
      404,
    );
  });
});
