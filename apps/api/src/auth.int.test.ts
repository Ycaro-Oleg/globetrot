import { randomBytes } from 'node:crypto';
import { schema } from '@globetrot/db';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { getAuthTables } from 'better-auth/db';
import { getTableColumns } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './auth';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';

const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
/** Each call gets its own client address, so the per-IP rate limiter never couples unrelated requests. */
const nextAddress = () => `203.0.113.${++addressCounter}`;

/** The parts of Better Auth's JSON responses these tests look at. */
interface AuthBody {
  code?: string;
  message?: string;
  token?: string;
  user?: { email: string; name: string; emailVerified: boolean };
}
const readJson = async (response: Response) => (await response.json()) as AuthBody;

interface CallOptions extends RequestInit {
  ip?: string | undefined;
  origin?: string | undefined;
  json?: unknown;
}

async function harness(env: Record<string, string> = {}) {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    // Generated at runtime: no secret is ever written in the repository.
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    ...env,
  });
  const { auth, app } = createServices(database.db, config.auth);
  const origin = config.auth.baseURL;

  const call = (path: string, init: CallOptions = {}) => {
    const { ip, json, origin: requestOrigin, headers, ...rest } = init;
    return app.request(`${origin}/api/auth${path}`, {
      ...rest,
      headers: {
        origin: requestOrigin ?? origin,
        'x-forwarded-for': ip ?? nextAddress(),
        ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        ...(headers as Record<string, string> | undefined),
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
  };
  const signUp = (body: Record<string, unknown> = {}, ip?: string) =>
    call('/sign-up/email', {
      method: 'POST',
      ip,
      json: { name: 'Ana', email: 'ana@example.com', password: PASSWORD, ...body },
    });
  const signIn = (body: Record<string, unknown>, ip?: string) =>
    call('/sign-in/email', { method: 'POST', ip, json: body });
  /** `null` when there is no valid session, as Better Auth answers. */
  const currentUser = async (cookie: string) => {
    const response = await call('/get-session', { headers: { cookie } });
    return (await response.json()) as { user: NonNullable<AuthBody['user']> } | null;
  };

  return { database, config, auth, app, call, signUp, signIn, currentUser };
}

/** `name=value; name2=value2`, ready to send back as a Cookie header. */
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

describe('sign up and sign in', () => {
  it('registers a user, opens a session, and sign-out ends it', async () => {
    const { signUp, currentUser, call, database } = await harness();

    const created = await signUp();
    expect(created.status).toBe(200);
    const body = await readJson(created);
    expect(body.user).toMatchObject({
      email: 'ana@example.com',
      name: 'Ana',
      emailVerified: false,
    });
    expect(JSON.stringify(body)).not.toMatch(/password/i);

    const cookie = cookieOf(created);
    expect(cookie).toContain('globetrot.session_token=');

    const current = await currentUser(cookie);
    expect(current?.user.email).toBe('ana@example.com');
    expect(JSON.stringify(current)).not.toMatch(/password/i);

    // The password is stored only as a hash, in the account table.
    const stored = await database.pool.query('SELECT password FROM account');
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].password).not.toContain(PASSWORD);

    const out = await call('/sign-out', { method: 'POST', json: {}, headers: { cookie } });
    expect(out.status).toBe(200);
    expect(await currentUser(cookie)).toBeNull();
  });

  it('signs in with the right password and opens a fresh session', async () => {
    const { signUp, signIn, currentUser } = await harness();
    await signUp();
    const res = await signIn({ email: 'ana@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect((await currentUser(cookieOf(res)))?.user.email).toBe('ana@example.com');
  });

  it('answers a wrong password and an unknown e-mail identically, so accounts cannot be enumerated', async () => {
    const { signUp, signIn } = await harness();
    await signUp();

    const wrongPassword = await signIn({ email: 'ana@example.com', password: 'not the password' });
    const unknownEmail = await signIn({
      email: 'nobody@example.com',
      password: 'not the password',
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(wrongPassword.status);
    const [a, b] = [await readJson(wrongPassword), await readJson(unknownEmail)];
    expect(a.code).toBe('INVALID_EMAIL_OR_PASSWORD');
    expect(b).toEqual(a);
    expect(wrongPassword.headers.getSetCookie()).toEqual([]);
    expect(unknownEmail.headers.getSetCookie()).toEqual([]);
  });
});

describe('e-mail addresses', () => {
  it('are unique regardless of case', async () => {
    const { signUp, database } = await harness();
    expect((await signUp({ email: 'Ana@Example.com' })).status).toBe(200);

    const duplicate = await signUp({ email: 'ana@EXAMPLE.COM' });
    expect(duplicate.status).toBeGreaterThanOrEqual(400);
    expect(duplicate.status).toBeLessThan(500);
    expect((await readJson(duplicate)).code).toMatch(/USER_ALREADY_EXISTS/);

    const users = await database.pool.query('SELECT email FROM "user"');
    expect(users.rows).toEqual([{ email: 'ana@example.com' }]);
  });

  it('are trimmed and lower-cased, and sign-in accepts any casing', async () => {
    const { signUp, signIn, database } = await harness();
    expect((await signUp({ email: '  Mixed@Example.COM ' })).status).toBe(200);

    const users = await database.pool.query('SELECT email FROM "user"');
    expect(users.rows).toEqual([{ email: 'mixed@example.com' }]);
    expect((await signIn({ email: ' MIXED@example.com', password: PASSWORD })).status).toBe(200);
  });

  it('are kept lower-case by the database itself, even for writes that bypass Better Auth', async () => {
    const { database } = await harness();
    await expect(
      database.pool.query(
        `INSERT INTO "user" (id, name, email) VALUES ('u1', 'Bob', 'Bob@Example.com')`,
      ),
    ).rejects.toThrow(/user_email_lowercase/);
  });
});

describe('password policy', () => {
  it(`rejects fewer than ${MIN_PASSWORD_LENGTH} and more than ${MAX_PASSWORD_LENGTH} characters with stable codes`, async () => {
    const { signUp, database } = await harness();

    const tooShort = await signUp({ password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) });
    expect(tooShort.status).toBe(400);
    expect((await readJson(tooShort)).code).toBe('PASSWORD_TOO_SHORT');

    const tooLong = await signUp({ password: 'x'.repeat(MAX_PASSWORD_LENGTH + 1) });
    expect(tooLong.status).toBe(400);
    expect((await readJson(tooLong)).code).toBe('PASSWORD_TOO_LONG');

    const users = await database.pool.query('SELECT count(*)::int AS n FROM "user"');
    expect(users.rows[0].n).toBe(0);
  });

  it('accepts both boundaries', async () => {
    const { signUp } = await harness();
    expect(
      (await signUp({ email: 'min@example.com', password: 'x'.repeat(MIN_PASSWORD_LENGTH) }))
        .status,
    ).toBe(200);
    expect(
      (await signUp({ email: 'max@example.com', password: 'x'.repeat(MAX_PASSWORD_LENGTH) }))
        .status,
    ).toBe(200);
  });
});

describe('sessions', () => {
  it('expire: a session past its expiry is no longer a session', async () => {
    const { signUp, currentUser, database } = await harness();
    const cookie = cookieOf(await signUp());
    expect((await currentUser(cookie))?.user.email).toBe('ana@example.com');

    await database.pool.query(`UPDATE session SET expires_at = now() - interval '1 minute'`);
    expect(await currentUser(cookie)).toBeNull();
  });

  it('last as long as the configured lifetime', async () => {
    const { signUp, database } = await harness({ SESSION_EXPIRES_IN_SECONDS: '3600' });
    await signUp();
    const { rows } = await database.pool.query(
      'SELECT extract(epoch FROM expires_at - created_at)::int AS lifetime FROM session',
    );
    expect(Math.abs(rows[0].lifetime - 3600)).toBeLessThanOrEqual(5);
  });

  it('record the client address from X-Forwarded-For, which is why the API must only be reachable through the web proxy', async () => {
    const { signUp, database } = await harness();
    await signUp({}, '198.51.100.77');
    const { rows } = await database.pool.query('SELECT ip_address FROM session');
    expect(rows[0].ip_address).toBe('198.51.100.77');
  });
});

describe('session cookie', () => {
  it('is HttpOnly, SameSite=Lax and not Secure in development', async () => {
    const { signUp } = await harness();
    const cookies = (await signUp()).headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('globetrot.session_token='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/;\s*HttpOnly/i);
    expect(sessionCookie).toMatch(/;\s*SameSite=Lax/i);
    expect(sessionCookie).toMatch(/;\s*Path=\//i);
    expect(sessionCookie).toMatch(/;\s*Max-Age=\d+/i);
    expect(sessionCookie).not.toMatch(/;\s*Secure/i);
  });

  it('is also Secure, with the __Secure- prefix, in production', async () => {
    const { signUp } = await harness({
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://app.example.test',
    });
    const cookies = (await signUp()).headers.getSetCookie();
    const sessionCookie = cookies.find((cookie) =>
      cookie.startsWith('__Secure-globetrot.session_token='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/;\s*Secure/i);
    expect(sessionCookie).toMatch(/;\s*HttpOnly/i);
    expect(sessionCookie).toMatch(/;\s*SameSite=Lax/i);
  });
});

describe('abuse protection', () => {
  it('returns 429 after too many failed sign-ins from one address, and only for that address', async () => {
    const { signUp, signIn, database } = await harness({ AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE: '3' });
    await signUp();
    const attacker = '192.0.2.50';
    const wrong = { email: 'ana@example.com', password: 'wrong password' };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++)
      statuses.push((await signIn(wrong, attacker)).status);
    expect(statuses).toEqual([401, 401, 401, 429]);

    const blocked = await signIn(wrong, attacker);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('x-retry-after'))).toBeGreaterThan(0);

    // Even the right password is refused while blocked, and another address is unaffected.
    expect((await signIn({ email: 'ana@example.com', password: PASSWORD }, attacker)).status).toBe(
      429,
    );
    expect((await signIn(wrong, '192.0.2.51')).status).toBe(401);

    // The counters live in PostgreSQL, not in memory.
    const counters = await database.pool.query('SELECT count(*)::int AS n FROM rate_limit');
    expect(counters.rows[0].n).toBeGreaterThan(0);
  });

  it('also limits sign-ups from one address', async () => {
    const { signUp } = await harness({ AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE: '2' });
    const ip = '192.0.2.60';
    expect((await signUp({ email: 'a@example.com' }, ip)).status).toBe(200);
    expect((await signUp({ email: 'b@example.com' }, ip)).status).toBe(200);
    expect((await signUp({ email: 'c@example.com' }, ip)).status).toBe(429);
  });

  it('refuses state-changing requests from an untrusted origin (CSRF)', async () => {
    const { call, database } = await harness();
    const res = await call('/sign-up/email', {
      method: 'POST',
      origin: 'https://evil.example',
      json: { name: 'Eve', email: 'eve@example.com', password: PASSWORD },
    });
    expect(res.status).toBe(403);
    const users = await database.pool.query('SELECT count(*)::int AS n FROM "user"');
    expect(users.rows[0].n).toBe(0);
  });

  it('does not let a hostile origin sign a user out, or sign in as someone else (login CSRF)', async () => {
    const { signUp, signIn, call, currentUser } = await harness();
    const cookie = cookieOf(await signUp());

    const signOut = await call('/sign-out', {
      method: 'POST',
      origin: 'https://evil.example',
      json: {},
      headers: { cookie },
    });
    expect(signOut.status).toBe(403);
    expect((await currentUser(cookie))?.user.email).toBe('ana@example.com');

    const login = await call('/sign-in/email', {
      method: 'POST',
      origin: 'https://evil.example',
      json: { email: 'ana@example.com', password: PASSWORD },
    });
    expect(login.status).toBe(403);
    expect(login.headers.getSetCookie()).toEqual([]);
    expect((await signIn({ email: 'ana@example.com', password: PASSWORD })).status).toBe(200);
  });
});

describe('schema contract', () => {
  it('has a column for every field Better Auth expects, so an upgrade cannot silently drift', async () => {
    const { auth } = await harness();
    const expected = getAuthTables(auth.options);
    const ours: Record<string, object> = {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    };

    expect(Object.keys(expected).sort()).toEqual(Object.keys(ours).sort());
    for (const [model, table] of Object.entries(expected)) {
      const columns = Object.keys(getTableColumns(ours[model] as never));
      const missing = ['id', ...Object.keys(table.fields)].filter(
        (field) => !columns.includes(field),
      );
      expect(missing, `columns missing for ${model}`).toEqual([]);
    }
  });
});
