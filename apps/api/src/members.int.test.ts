// Planning a trip together against a real PostgreSQL (ADR-0024): an invite link joins an editor or a viewer,
// each sees and does only what the role allows, strangers get "not found", and a revoked link stops working.
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
const nextAddress = () => `198.18.6.${++addressCounter}`;

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
  async function signUp(name: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': nextAddress() },
      body: JSON.stringify({
        name,
        email: `${name.toLowerCase()}@example.com`,
        password: PASSWORD,
      }),
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
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
  };
  return { signUp, call };
}

const stop = {
  placeKey: 't:lisboa',
  name: 'Lisboa',
  countryCode: 'PT',
  latitude: 38.72,
  longitude: -9.14,
  nights: 4,
};

describe('trip members against a real database', () => {
  it('joins an editor and a viewer by link, with what each role allows, and keeps strangers out', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana');
    const bruno = await signUp('Bruno');
    const carla = await signUp('Carla');
    const dani = await signUp('Dani');
    const trip = (await call(ana.cookie, 'POST', '/v1/trips', { title: 'Lisboa' })).json;
    const id = trip.id as string;

    const editorLink = await call(ana.cookie, 'POST', `/v1/trips/${id}/invites`, {
      role: 'editor',
    });
    expect(editorLink.status).toBe(201);
    const viewerLink = await call(ana.cookie, 'POST', `/v1/trips/${id}/invites`, {
      role: 'viewer',
    });
    // Only the owner makes links.
    expect((await call(bruno.cookie, 'POST', `/v1/trips/${id}/invites`, {})).status).toBe(404);

    const preview = await call(bruno.cookie, 'GET', `/v1/invites/${editorLink.json.token}`);
    expect(preview.json).toMatchObject({ tripTitle: 'Lisboa', ownerName: 'Ana', joined: false });
    expect((await call(null, 'GET', `/v1/invites/${editorLink.json.token}`)).status).toBe(401);
    expect(
      (await call(bruno.cookie, 'POST', `/v1/invites/${editorLink.json.token}`)).json,
    ).toMatchObject({ id, role: 'editor' });
    await call(carla.cookie, 'POST', `/v1/invites/${viewerLink.json.token}`);

    // The editor changes the plan; the viewer only reads it.
    const route = { destinations: [stop] };
    expect((await call(bruno.cookie, 'PUT', `/v1/trips/${id}/destinations`, route)).status).toBe(
      200,
    );
    expect((await call(carla.cookie, 'GET', `/v1/trips/${id}/destinations`)).status).toBe(200);
    expect((await call(carla.cookie, 'PUT', `/v1/trips/${id}/destinations`, route)).status).toBe(
      403,
    );
    expect((await call(bruno.cookie, 'POST', `/v1/trips/${id}/archive`)).status).toBe(404);
    expect((await call(dani.cookie, 'GET', `/v1/trips/${id}`)).status).toBe(404);
    expect((await call(dani.cookie, 'GET', `/v1/trips/${id}/members`)).status).toBe(404);

    const people = await call(carla.cookie, 'GET', `/v1/trips/${id}/members`);
    expect((people.json.members as { name: string; role: string }[]).map((m) => m.role)).toEqual([
      'owner',
      'editor',
      'viewer',
    ]);
    expect(people.json.invites).toEqual([]);
    const listed = (await call(bruno.cookie, 'GET', '/v1/trips')).json.trips as { role: string }[];
    expect(listed).toMatchObject([{ id, role: 'editor' }]);

    // Revoking stops the link; the owner removes someone and a member leaves.
    const open = (await call(ana.cookie, 'GET', `/v1/trips/${id}/members`)).json.invites as {
      id: string;
    }[];
    for (const invite of open) {
      expect(
        (await call(ana.cookie, 'DELETE', `/v1/trips/${id}/invites/${invite.id}`)).status,
      ).toBe(200);
    }
    expect((await call(dani.cookie, 'POST', `/v1/invites/${editorLink.json.token}`)).status).toBe(
      404,
    );
    expect((await call(ana.cookie, 'DELETE', `/v1/trips/${id}/members/${carla.id}`)).status).toBe(
      200,
    );
    expect((await call(bruno.cookie, 'POST', `/v1/trips/${id}/leave`)).status).toBe(200);
    expect((await call(bruno.cookie, 'GET', `/v1/trips/${id}`)).status).toBe(404);
  });
});

describe('money between members against a real database', () => {
  it('records who paid, splits the trip and settles the paid costs', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana');
    const bruno = await signUp('Bruno');
    const carla = await signUp('Carla');
    const id = (await call(ana.cookie, 'POST', '/v1/trips', { title: 'Lisboa', currency: 'EUR' }))
      .json.id as string;
    const link = (await call(ana.cookie, 'POST', `/v1/trips/${id}/invites`, {})).json.token;
    await call(bruno.cookie, 'POST', `/v1/invites/${link}`);
    const cost = (amount: string, paidBy: string | null) =>
      call(bruno.cookie, 'POST', `/v1/trips/${id}/expenses`, {
        description: 'Hotel',
        category: 'stay',
        status: 'paid',
        amount,
        currency: 'EUR',
        paidBy,
      });
    expect((await cost('300', ana.id)).json.paidBy).toBe(ana.id);
    await cost('100', bruno.id);
    expect((await cost('10', carla.id)).status).toBe(422);
    expect(
      (await call(bruno.cookie, 'PUT', `/v1/trips/${id}/money/me`, { saved: '50', monthly: '25' }))
        .status,
    ).toBe(200);
    const money = (await call(ana.cookie, 'GET', `/v1/trips/${id}/money`)).json as {
      people: { name: string; share: { amount: string }; saved: { amount: string } }[];
      settlement: { transfers: { fromName: string; toName: string; amount: { amount: string } }[] };
    };
    expect(money.people.map((p) => [p.name, p.share.amount, p.saved.amount])).toEqual([
      ['Ana', '200.00', '0.00'],
      ['Bruno', '200.00', '50.00'],
    ]);
    expect(money.settlement.transfers).toMatchObject([
      { fromName: 'Bruno', toName: 'Ana', amount: { amount: '100.00' } },
    ]);
    expect(
      (
        await call(bruno.cookie, 'PUT', `/v1/trips/${id}/shares`, {
          shares: [
            { userId: ana.id, shareBp: 5000 },
            { userId: bruno.id, shareBp: 5000 },
          ],
        })
      ).status,
    ).toBe(404);
    expect((await call(carla.cookie, 'GET', `/v1/trips/${id}/money`)).status).toBe(404);
  });
});
