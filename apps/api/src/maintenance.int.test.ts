// Housekeeping against a real PostgreSQL (the worker's queries): uploads never placed go after a day, placed
// ones stay, stored images whose row is gone are removed, and old idempotency records are cleared.
import { randomBytes } from 'node:crypto';
import { createMaintenance } from '@globetrot/application';
import { createFakeEmail } from '@globetrot/application/testing';
import { createMaintenanceRepository, schema } from '@globetrot/db';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { uuidV7 } from '@globetrot/domain';
import { createMemoryStorage } from '@globetrot/storage';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

const chunk = (type: string, data: number[]) => [
  0,
  0,
  0,
  data.length,
  ...[...type].map((c) => c.charCodeAt(0)),
  ...data,
  0,
  0,
  0,
  0,
];
const PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
  ...chunk('IDAT', [1, 2]),
  ...chunk('IEND', []),
]);

describe('maintenance (PostgreSQL)', () => {
  it('sweeps what nobody uses and keeps what is placed', async () => {
    const database = await createTestDatabase();
    databases.push(database);
    const config = loadApiConfig({
      NODE_ENV: 'test',
      DATABASE_URL: database.url,
      BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
      REQUIRE_VERIFIED_EMAIL: 'false',
    });
    const storage = createMemoryStorage();
    const { app } = createServices(database.db, config, { email: createFakeEmail().port, storage });
    const origin = config.auth.baseURL;
    const signUp = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '198.18.10.1' },
      body: JSON.stringify({
        name: 'Ana',
        email: 'm@example.test',
        password: 'correct horse battery staple',
      }),
    });
    const cookie = signUp.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const upload = async () =>
      (
        (await (
          await app.request(`${origin}/v1/media`, {
            method: 'POST',
            headers: { origin, cookie, 'content-type': 'image/png' },
            body: PNG,
          })
        ).json()) as { id: string }
      ).id;
    const unused = await upload();
    const onPost = await upload();
    await app.request(`${origin}/v1/community/posts`, {
      method: 'POST',
      headers: { origin, cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'moment', photos: [{ mediaId: onPost, alt: '' }] }),
    });
    // A stored image whose row is gone, made two hours ago.
    const stray = uuidV7(Date.now() - 2 * 3600_000, crypto.getRandomValues(new Uint8Array(10)));
    await storage.put(`media/${stray}`, PNG, 'image/png');
    // An idempotency record from last month.
    const [user] = await database.db.select({ id: schema.user.id }).from(schema.user);
    await database.db.insert(schema.idempotencyKey).values({
      ownerId: user!.id,
      key: 'old-key-0001',
      fingerprint: 'x',
      response: null,
      createdAt: new Date(Date.now() - 30 * 24 * 3600_000),
    });

    const tomorrow = new Date(Date.now() + 25 * 3600_000);
    const maintenance = createMaintenance({
      store: createMaintenanceRepository(database.db),
      storage,
      clock: { now: () => tomorrow },
    });
    expect(await maintenance.run()).toEqual({
      unplacedMedia: 1,
      strayObjects: 1,
      idempotencyKeys: 1,
    });
    const left = await database.db.select({ id: schema.mediaAsset.id }).from(schema.mediaAsset);
    expect(left.map((row) => row.id)).toEqual([onPost]);
    expect(await storage.get(`media/${unused}`)).toBeNull();
    expect(await storage.get(`media/${stray}`)).toBeNull();
    expect(await storage.get(`media/${onPost}`)).not.toBeNull();
    expect(
      await database.db
        .select()
        .from(schema.idempotencyKey)
        .where(eq(schema.idempotencyKey.key, 'old-key-0001')),
    ).toEqual([]);
    expect(await maintenance.run()).toEqual({
      unplacedMedia: 0,
      strayObjects: 0,
      idempotencyKeys: 0,
    });
  });
});
