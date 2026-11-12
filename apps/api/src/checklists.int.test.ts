// Checklists against a real PostgreSQL: order, toggling, ownership, the database constraints and the cascade.
import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
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

type Checklist = {
  items: { id: string; label: string; done: boolean }[];
  readiness: Record<string, boolean>;
};

describe('checklists against a real database', () => {
  it('adds, checks, renames and removes items, and the stamps follow', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    const base = `/v1/trips/${id}/checklist`;

    const empty = await call(ana.cookie, 'GET', base);
    expect(empty.response.status).toBe(200);
    expect((empty.json as unknown as Checklist).items).toEqual([]);

    const added = await call(ana.cookie, 'POST', base, {
      items: [
        { group: 'documents', label: 'Passport' },
        { group: 'packing', label: 'Charger' },
      ],
    });
    expect(added.response.status).toBe(201);
    const list = added.json as unknown as Checklist;
    expect(list.items.map((item) => item.label)).toEqual(['Passport', 'Charger']);

    const checked = await call(ana.cookie, 'PATCH', `${base}/${list.items[0]!.id}`, { done: true });
    expect(checked.response.status).toBe(200);
    expect((checked.json as unknown as Checklist).readiness).toMatchObject({
      docs: true,
      check: false,
    });

    const renamed = await call(ana.cookie, 'PATCH', `${base}/${list.items[1]!.id}`, {
      label: 'Charger and plug adapter',
    });
    expect((renamed.json as unknown as Checklist).items[1]?.label).toBe('Charger and plug adapter');

    const removed = await call(ana.cookie, 'DELETE', `${base}/${list.items[1]!.id}`);
    expect((removed.json as unknown as Checklist).items).toHaveLength(1);
    // the only item left is done: every list is complete
    expect((removed.json as unknown as Checklist).readiness.check).toBe(true);
  });

  it('refuses bad input with 422, and answers "not found" for another user’s trip or item', async () => {
    const { signUp, call, tripFor } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const bruno = await signUp('Bruno', 'bruno@example.com');
    const id = await tripFor(ana.cookie);
    const base = `/v1/trips/${id}/checklist`;
    const added = await call(ana.cookie, 'POST', base, {
      items: [{ group: 'documents', label: 'Passport' }],
    });
    const itemId = (added.json as unknown as Checklist).items[0]!.id;

    expect((await call(ana.cookie, 'POST', base, { items: [] })).response.status).toBe(422);
    expect(
      (await call(ana.cookie, 'POST', base, { items: [{ group: 'nope', label: 'x' }] })).response
        .status,
    ).toBe(422);
    expect((await call(ana.cookie, 'PATCH', `${base}/${itemId}`, {})).response.status).toBe(422);

    expect((await call(bruno.cookie, 'GET', base)).response.status).toBe(404);
    expect(
      (await call(bruno.cookie, 'PATCH', `${base}/${itemId}`, { done: true })).response.status,
    ).toBe(404);
    expect((await call(bruno.cookie, 'DELETE', `${base}/${itemId}`)).response.status).toBe(404);
    expect((await call(null, 'GET', base)).response.status).toBe(401);
  });

  it('removes the lists with the trip’s row (cascade) and the database rejects what the API would', async () => {
    const { signUp, call, tripFor, database } = await harness();
    const ana = await signUp('Ana', 'ana@example.com');
    const id = await tripFor(ana.cookie);
    await call(ana.cookie, 'POST', `/v1/trips/${id}/checklist`, {
      items: [{ group: 'money', label: 'Tell the bank' }],
    });
    await expect(
      database.db.insert(schema.checklistItem).values({
        id: randomBytes(16)
          .toString('hex')
          .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5'),
        tripId: id,
        group: 'nonsense',
        label: 'x',
      }),
    ).rejects.toThrow();
    await database.db.delete(schema.trip);
    expect(await database.db.select().from(schema.checklistItem)).toEqual([]);
  });
});
