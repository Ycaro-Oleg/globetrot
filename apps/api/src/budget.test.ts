import { createApplication, type UserRecord } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it } from 'vitest';
import { createApp, type AuthService } from './app';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const auth: AuthService = {
  async handler() {
    return new Response('{}');
  },
  async getSession(headers) {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(headers.get('cookie') ?? '');
    return match?.[1] ? { userId: match[1] } : null;
  },
};

const COST = {
  description: 'Flights',
  category: 'flights',
  status: 'estimate',
  amount: '1250.00',
  currency: 'USD',
};

async function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  const application = createApplication(fake.ports);
  const app = createApp({ auth, application, trustedOrigins: ['http://localhost:3000'] });
  const trip = await application.createTrip.execute(
    { kind: 'user', userId: ana.id },
    { title: 'Japan 2027', startDate: '2027-04-03' },
  );
  const call = async (user: UserRecord | null, method: string, path: string, body?: unknown) => {
    const response = await app.request(`/v1/trips/${trip.id}${path}`, {
      method,
      headers: {
        ...(user ? { cookie: `session=${user.id}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: (await response.json()) as Record<string, unknown> };
  };
  return { ...fake, trip, call };
}

describe('budget routes', () => {
  it('need a session', async () => {
    const { call } = await setup();
    for (const [method, path, body] of [
      ['GET', '/budget', undefined],
      ['GET', '/expenses', undefined],
      ['POST', '/expenses', COST],
      ['PUT', '/savings', { saved: '1' }],
    ] as const) {
      const { response, json } = await call(null, method, path, body);
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(json.code).toBe('UNAUTHENTICATED');
    }
  });

  it('add a cost, list it, change it, see the budget and remove it', async () => {
    const { call } = await setup();
    const created = await call(ana, 'POST', '/expenses', COST);
    expect(created.response.status).toBe(201);
    const id = created.json.id as string;
    expect((await call(ana, 'GET', '/expenses')).json.expenses).toHaveLength(1);

    const changed = await call(ana, 'PUT', `/expenses/${id}`, {
      ...COST,
      status: 'paid',
      amount: '1300.00',
    });
    expect(changed.response.status).toBe(200);
    expect(changed.json).toMatchObject({ status: 'paid', inTripCurrency: { amount: '1300.00' } });

    const saved = await call(ana, 'PUT', '/savings', { saved: '300', monthly: '200' });
    expect(saved.response.status).toBe(200);
    expect(saved.json).toMatchObject({
      total: { amount: '1300.00' },
      savings: { status: 'saving', monthsNeeded: 5 },
    });
    expect((await call(ana, 'GET', '/budget')).json).toMatchObject({
      currency: 'USD',
      savings: { left: { amount: '1000.00' } },
    });

    expect((await call(ana, 'DELETE', `/expenses/${id}`)).response.status).toBe(200);
    expect((await call(ana, 'GET', '/expenses')).json.expenses).toEqual([]);
  });

  it('answer "not found" for someone else’s trip, the same as for a missing cost', async () => {
    const { call } = await setup();
    const created = await call(ana, 'POST', '/expenses', COST);
    const id = created.json.id as string;
    const theirs = await call(bruno, 'GET', '/budget');
    const missing = await call(ana, 'DELETE', '/expenses/0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d9e');
    expect(theirs.response.status).toBe(404);
    expect(missing.response.status).toBe(404);
    expect(theirs.json).toEqual(missing.json);
    for (const [method, path, body] of [
      ['POST', '/expenses', COST],
      ['PUT', `/expenses/${id}`, COST],
      ['DELETE', `/expenses/${id}`, undefined],
      ['PUT', '/savings', { saved: '1' }],
    ] as const) {
      expect((await call(bruno, method, path, body)).response.status, `${method} ${path}`).toBe(
        404,
      );
    }
  });

  it.each([
    ['a foreign cost with no rate', { ...COST, currency: 'JPY', amount: '1000' }, 'fxRate'],
    ['a zero amount', { ...COST, amount: '0' }, 'amount'],
    ['an unknown category', { ...COST, category: 'fun' }, 'category'],
    ['too many decimals', { ...COST, amount: '1.234' }, 'amount'],
  ])('refuse %s with 422 problem+json naming the field', async (_name, body, field) => {
    const { call } = await setup();
    const { response, json } = await call(ana, 'POST', '/expenses', body);
    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(JSON.stringify(json)).toContain(field);
  });
});
