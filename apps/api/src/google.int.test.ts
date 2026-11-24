// Google sign-in against a real PostgreSQL, with a stubbed Google: no network, no real credentials.
// The token endpoint answers with an id token for a profile the test chooses.
import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const CLIENT = {
  GOOGLE_CLIENT_ID: 'test-client.apps.example',
  GOOGLE_CLIENT_SECRET: 'test-secret',
};

const databases: TestDatabase[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let profile: Record<string, unknown> = {};
const realFetch = globalThis.fetch;
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

beforeEach(() => {
  // Only Google's token endpoint is stubbed; everything else is untouched.
  vi.stubGlobal('fetch', async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const idToken = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: 'https://accounts.google.com', aud: CLIENT.GOOGLE_CLIENT_ID, ...profile })}.x`;
      return new Response(
        JSON.stringify({
          access_token: 'stub-access',
          id_token: idToken,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return realFetch(input, init);
  });
});

let addressCounter = 0;
const nextAddress = () => `203.0.113.${++addressCounter}`;

async function harness(withGoogle = true) {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    REQUIRE_VERIFIED_EMAIL: 'false',
    ...(withGoogle ? CLIENT : {}),
  });
  const { app } = createServices(database.db, config, { email: createFakeEmail().port });
  const origin = config.auth.baseURL;

  const request = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const { cookie, ...rest } = init;
    return app.request(`${origin}${path}`, {
      ...rest,
      headers: {
        origin,
        'x-forwarded-for': nextAddress(),
        ...(cookie ? { cookie } : {}),
        ...((rest.headers as Record<string, string> | undefined) ?? {}),
      },
    });
  };
  const cookiesOf = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');

  async function signUp(name: string, email: string) {
    const response = await request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as { user: { id: string } }).user.id;
  }

  /** Starts the flow and comes back from "Google" with a profile: the whole round trip. */
  async function signInWithGoogle(googleProfile: Record<string, unknown>, locale = 'en') {
    profile = googleProfile;
    const cookie = `globetrot_locale=${locale}`;
    const start = await request('/api/auth/sign-in/social', {
      method: 'POST',
      cookie,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/app' }),
    });
    const body = (await start.json()) as { url?: string };
    const state = new URL(body.url ?? 'http://x').searchParams.get('state') ?? '';
    const callback = await request(`/api/auth/callback/google?code=stub-code&state=${state}`, {
      cookie: [cookie, cookiesOf(start)].filter(Boolean).join('; '),
      redirect: 'manual',
    });
    return { start, startBody: body, callback, location: callback.headers.get('location') ?? '' };
  }
  return { database, signUp, request, signInWithGoogle, cookiesOf, origin };
}

const GOOGLE_ANA = {
  sub: 'g-ana',
  email: 'ana@example.com',
  email_verified: true,
  name: 'Ana Google',
};

describe('Google sign-in against a real database', () => {
  it('starts the flow at Google with the configured client and the web origin’s callback', async () => {
    const { request, origin } = await harness();
    const start = await request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/app' }),
    });
    expect(start.status).toBe(200);
    const url = new URL(((await start.json()) as { url: string }).url);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(CLIENT.GOOGLE_CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback/google`);
  });

  it('is off without credentials: no provider to start', async () => {
    const { request } = await harness(false);
    const start = await request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/app' }),
    });
    expect(start.status).toBeGreaterThanOrEqual(400);
  });

  it('creates a new, verified account in the language the visitor was using', async () => {
    const { signInWithGoogle, database, cookiesOf } = await harness();
    const { callback, location } = await signInWithGoogle(GOOGLE_ANA, 'pt-BR');
    expect(callback.status).toBe(302);
    expect(new URL(location, 'http://x').pathname).toBe('/app');
    expect(cookiesOf(callback)).toContain('globetrot.session_token=');

    const users = await database.db.select().from(schema.user);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'ana@example.com', emailVerified: true });
    const [preference] = await database.db.select().from(schema.userPreference);
    // The language comes from the cookie, nothing from the Google profile; every other setting is a default.
    expect(preference).toMatchObject({
      locale: 'pt-BR',
      currency: 'USD',
      homeCountry: null,
      nationality: null,
      timeZone: null,
    });
  });

  it('links to an existing account when both sides have verified the same address', async () => {
    const { signUp, signInWithGoogle, database } = await harness();
    const existing = await signUp('Ana', 'ana@example.com');
    await database.db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.id, existing));
    const { callback, location } = await signInWithGoogle(GOOGLE_ANA);
    expect(callback.status).toBe(302);
    expect(new URL(location, 'http://x').pathname).toBe('/app');
    expect(await database.db.select().from(schema.user)).toHaveLength(1);
    const accounts = await database.db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, existing));
    expect(accounts.map((account) => account.providerId).sort()).toEqual(['credential', 'google']);
  });

  it('never links to a local account whose address was never verified (it could be a squatter’s)', async () => {
    // Someone signs up with another person's address and a password they know; when the real owner later comes
    // in with Google, they must not land in that account.
    const { signUp, signInWithGoogle, database, cookiesOf } = await harness();
    await signUp('Squatter', 'ana@example.com');
    const { callback, location } = await signInWithGoogle(GOOGLE_ANA);
    expect(new URL(location, 'http://x').pathname).toBe('/login');
    expect(cookiesOf(callback)).not.toContain('session_token=');
    const accounts = await database.db.select().from(schema.account);
    expect(accounts.map((account) => account.providerId)).toEqual(['credential']);
  });

  it('never links on an address Google has not verified', async () => {
    const { signUp, signInWithGoogle, database, cookiesOf } = await harness();
    await signUp('Ana', 'ana@example.com');
    const { callback, location } = await signInWithGoogle({ ...GOOGLE_ANA, email_verified: false });
    expect(location).toContain('/login');
    expect(new URL(location, 'http://x').searchParams.get('error')).toBeTruthy();
    expect(cookiesOf(callback)).not.toContain('session_token=');
    const accounts = await database.db.select().from(schema.account);
    expect(accounts.map((account) => account.providerId)).toEqual(['credential']);
  });

  it('does not attach a Google identity to an account with a different address', async () => {
    const { signUp, signInWithGoogle, database } = await harness();
    await signUp('Bruno', 'bruno@example.com');
    await signInWithGoogle({ ...GOOGLE_ANA, email: 'ana@example.com' });
    const users = await database.db.select().from(schema.user);
    expect(users.map((user) => user.email).sort()).toEqual([
      'ana@example.com',
      'bruno@example.com',
    ]);
    const bruno = users.find((user) => user.email === 'bruno@example.com');
    const brunoAccounts = await database.db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, bruno!.id));
    expect(brunoAccounts.map((account) => account.providerId)).toEqual(['credential']);
  });

  it('sends a denied consent and a wrong state back to the sign-in page with a code and nothing else', async () => {
    const { request, signInWithGoogle } = await harness();
    const denied = await request('/api/auth/callback/google?error=access_denied&state=whatever', {
      redirect: 'manual',
    });
    expect(denied.status).toBe(302);
    const deniedAt = new URL(denied.headers.get('location') ?? '', 'http://x');
    expect(deniedAt.pathname).toBe('/login');
    expect(deniedAt.searchParams.get('error')).toBeTruthy();

    const wrongState = await request(
      '/api/auth/callback/google?code=stub-code&state=not-a-real-state',
      { redirect: 'manual' },
    );
    expect(wrongState.status).toBe(302);
    const location = wrongState.headers.get('location') ?? '';
    expect(new URL(location, 'http://x').pathname).toBe('/login');
    for (const text of [location, await wrongState.text()]) {
      expect(text).not.toMatch(/stack|at \w+ \(|node_modules|stub-code|stub-access/i);
    }
    // And a good round trip still works afterwards.
    expect((await signInWithGoogle(GOOGLE_ANA)).callback.status).toBe(302);
  });
});
