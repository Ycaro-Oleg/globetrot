// Export and deletion of an account against a real PostgreSQL: the export holds the person's own data and no
// secrets; deletion removes everything they own (rows and stored images), signs them out everywhere, and
// keeps only the audit rows, which never held personal data.
import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createMemoryStorage } from '@globetrot/storage';
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
  ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
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
  const storage = createMemoryStorage();
  const { app } = createServices(database.db, config, { email: createFakeEmail().port, storage });
  const origin = config.auth.baseURL;
  const ip = () => `198.18.8.${++counter}`;
  async function signUp(name: string, email: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': ip() },
      body: JSON.stringify({ name, email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
  }
  const signIn = (email: string) =>
    app.request(`${origin}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': ip() },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
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
    const text = await response.text();
    return { response, text, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
  };
  const upload = (cookie: string) =>
    app.request(`${origin}/v1/media`, {
      method: 'POST',
      headers: { origin, cookie, 'content-type': 'image/png' },
      body: PNG,
    });
  return { database, storage, signUp, signIn, call, upload };
}

describe('account export and deletion (PostgreSQL)', () => {
  it('exports the person’s own data, without secrets or other people’s data', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana Ribeiro', 'ana@example.test');
    const leo = await signUp('Leo Tanaka', 'leo@example.test');
    await call(ana, 'POST', '/v1/trips', { title: 'Japan 2027' });
    await call(leo, 'POST', '/v1/trips', { title: 'Leo private trip' });
    await call(ana, 'POST', '/v1/community/posts', { kind: 'tip', body: 'Go early.' });
    const { response, text, json } = await call(ana, 'GET', '/v1/me/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(
      /attachment; filename="globetrot-export-/,
    );
    expect(json).toMatchObject({ format: 'globetrot-account-export', version: 1 });
    expect(text).toContain('Japan 2027');
    expect(text).toContain('Go early.');
    expect(text).toContain('ana@example.test');
    expect(text).not.toContain('Leo private trip');
    expect(text).not.toContain('leo@example.test');
    expect(text.toLowerCase()).not.toContain('password');
    expect(text).not.toContain('token');
  });

  it('deletes everything the account owns, signs it out and keeps only the audit rows', async () => {
    const { database, storage, signUp, signIn, call, upload } = await harness();
    const ana = await signUp('Ana Ribeiro', 'ana@example.test');
    const leo = await signUp('Leo Tanaka', 'leo@example.test');
    const { json: trip } = await call(ana, 'POST', '/v1/trips', { title: 'Japan 2027' });
    const media = (await (await upload(ana)).json()) as { id: string };
    const { json: post } = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'moment',
      photos: [{ mediaId: media.id, alt: '' }],
    });
    const { json: leoPost } = await call(leo, 'POST', '/v1/community/posts', {
      kind: 'tip',
      body: 'Leo tip',
    });
    await call(ana, 'POST', `/v1/community/posts/${leoPost.id as string}/comments`, {
      body: 'Thanks',
    });
    await call(ana, 'PUT', '/v1/community/people/leo.tanaka/follow');
    expect(await storage.get(`media/${media.id}`)).not.toBeNull();

    const wrong = await call(ana, 'DELETE', '/v1/me', { confirmEmail: 'leo@example.test' });
    expect(wrong.response.status).toBe(422);
    const done = await call(ana, 'DELETE', '/v1/me', { confirmEmail: 'ANA@example.test' });
    expect(done.response.status).toBe(200);

    expect((await call(ana, 'GET', '/v1/me')).response.status).toBe(401);
    expect((await signIn('ana@example.test')).status).not.toBe(200);
    expect(await storage.get(`media/${media.id}`)).toBeNull();
    const db = database.db;
    expect(
      await db
        .select()
        .from(schema.trip)
        .where(eq(schema.trip.id, trip.id as string)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.post)
        .where(eq(schema.post.id, post.id as string)),
    ).toEqual([]);
    expect(await db.select().from(schema.postComment)).toEqual([]);
    expect(await db.select().from(schema.follow)).toEqual([]);
    expect(
      (await call(leo, 'GET', `/v1/community/posts/${leoPost.id as string}`)).json.comments,
    ).toBe(0);
    const audit = await db
      .select()
      .from(schema.auditEvent)
      .where(eq(schema.auditEvent.action, 'account.delete'));
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain('example.test');
    // Leo is untouched.
    expect((await call(leo, 'GET', '/v1/me')).response.status).toBe(200);
  });

  it('deletes an archived trip only, and only one’s own', async () => {
    const { signUp, call } = await harness();
    const ana = await signUp('Ana Ribeiro', 'ana@example.test');
    const leo = await signUp('Leo Tanaka', 'leo@example.test');
    const { json: trip } = await call(ana, 'POST', '/v1/trips', { title: 'Japan 2027' });
    const id = trip.id as string;
    expect((await call(ana, 'DELETE', `/v1/trips/${id}`)).response.status).toBe(422);
    await call(ana, 'PATCH', `/v1/trips/${id}`, { status: 'archived' });
    expect((await call(leo, 'DELETE', `/v1/trips/${id}`)).response.status).toBe(404);
    expect((await call(ana, 'DELETE', `/v1/trips/${id}`)).response.status).toBe(200);
    expect((await call(ana, 'GET', `/v1/trips/${id}`)).response.status).toBe(404);
  });
});
