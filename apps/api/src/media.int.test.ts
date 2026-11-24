// Uploads against a real PostgreSQL: the type is read from the bytes, metadata is removed, the size is capped,
// and an image is served only to its owner or to people who may see a post that shows it. The S3 adapter is
// also checked against the local SeaweedFS when it is running.
import { randomBytes } from 'node:crypto';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createMemoryStorage, createS3Storage } from '@globetrot/storage';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
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
  ...chunk('IHDR', [0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0]),
  ...chunk(
    'tEXt',
    [...'GPS\0-23.55,-46.63'].map((c) => c.charCodeAt(0)),
  ),
  ...chunk('IDAT', [1, 2]),
  ...chunk('IEND', []),
]);

let counter = 0;
async function harness() {
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
    storage: createMemoryStorage(),
  });
  const origin = config.auth.baseURL;
  async function signUp(name: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-forwarded-for': `198.18.6.${++counter}`,
      },
      body: JSON.stringify({ name, email: `media${counter}@example.test`, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
  }
  const upload = (cookie: string, body: Uint8Array, type = 'image/png') =>
    app.request(`${origin}/v1/media`, {
      method: 'POST',
      headers: { origin, cookie, 'content-type': type },
      body,
    });
  const get = (cookie: string, path: string) =>
    app.request(`${origin}${path}`, { headers: { cookie } });
  const json = (cookie: string, method: string, path: string, body: unknown) =>
    app.request(`${origin}${path}`, {
      method,
      headers: { origin, cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { signUp, upload, get, json };
}

describe('media (PostgreSQL)', () => {
  it('stores an image without metadata and serves it only to whoever may see it', async () => {
    const { signUp, upload, get, json } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const leo = await signUp('Leo Tanaka');
    const created = await upload(ana, PNG);
    expect(created.status).toBe(201);
    const media = (await created.json()) as { id: string; width: number; height: number };
    expect(media).toMatchObject({ width: 2, height: 3 });

    const mine = await get(ana, `/v1/media/${media.id}`);
    expect(mine.status).toBe(200);
    expect(mine.headers.get('content-type')).toBe('image/png');
    expect(mine.headers.get('cache-control')).toContain('private');
    const bytes = Buffer.from(await mine.arrayBuffer());
    expect(bytes.includes(Buffer.from('-23.55'))).toBe(false);

    expect((await get(leo, `/v1/media/${media.id}`)).status).toBe(404);
    const posted = await json(ana, 'POST', '/v1/community/posts', {
      kind: 'moment',
      photos: [{ mediaId: media.id, alt: 'Two by three' }],
    });
    expect(posted.status).toBe(201);
    expect((await get(leo, `/v1/media/${media.id}`)).status).toBe(200);
    const stolen = await json(leo, 'POST', '/v1/community/posts', {
      kind: 'moment',
      photos: [{ mediaId: media.id, alt: '' }],
    });
    expect(stolen.status).toBe(422);
  });

  it('refuses what is not an image, whatever the header says, and anything over 8 MB', async () => {
    const { signUp, upload } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect((await upload(ana, svg, 'image/png')).status).toBe(422);
    expect((await upload(ana, new Uint8Array(8 * 1024 * 1024 + 1), 'image/jpeg')).status).toBe(413);
  });

  it('needs a session', async () => {
    const { upload } = await harness();
    expect((await upload('', PNG)).status).toBe(401);
  });
});

const s3 = loadApiConfig({ ...process.env, NODE_ENV: 'test' }).storage;
const s3Up = await fetch(s3.endpoint, { signal: AbortSignal.timeout(1000) }).then(
  () => true,
  () => false,
);

describe.skipIf(!s3Up)('S3 adapter (local SeaweedFS)', () => {
  it('puts and gets an object, and answers null for a missing one', async () => {
    const storage = createS3Storage(s3);
    const key = `test/${crypto.randomUUID()}`;
    await storage.put(key, PNG, 'image/png');
    expect(Buffer.from((await storage.get(key))!)).toEqual(Buffer.from(PNG));
    expect(await storage.get(`test/${crypto.randomUUID()}`)).toBeNull();
    const listed = await storage.list('test/');
    expect(listed.keys).toContain(key);
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
    expect((await storage.list('test/')).keys).not.toContain(key);
  });
});
