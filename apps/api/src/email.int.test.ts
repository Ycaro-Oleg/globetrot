import { randomBytes } from 'node:crypto';
import { catalogs } from '@globetrot/i18n';
import { createMetricsRepository, schema } from '@globetrot/db';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiConfig } from './config';
import {
  linkIn,
  mailsAfterWaiting,
  mailsFor,
  pathOf,
  randomAddress,
  waitForMails,
} from './testing/mailpit';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a completely different passphrase';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const databases: TestDatabase[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

/** Everything the process logs while a test runs, to prove none of it holds a token or an address. */
let logged: string[] = [];
beforeEach(() => {
  logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
  }
});

let addressCounter = 0;
const nextIp = () => `198.18.0.${++addressCounter}`;

async function harness(env: Record<string, string> = {}) {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    ...(process.env.SMTP_PORT ? { SMTP_PORT: process.env.SMTP_PORT } : {}),
    ...env,
  });
  const { app } = createServices(database.db, config);
  const origin = config.auth.baseURL;

  const call = (
    path: string,
    init: { method?: string; json?: unknown; cookie?: string; ip?: string; language?: string } = {},
  ) =>
    app.request(`${origin}${path}`, {
      method: init.method ?? (init.json === undefined ? 'GET' : 'POST'),
      headers: {
        origin,
        'x-forwarded-for': init.ip ?? nextIp(),
        ...(init.json === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init.cookie ? { cookie: init.cookie } : {}),
        ...(init.language ? { cookie: `globetrot_locale=${init.language}` } : {}),
      },
      ...(init.json === undefined ? {} : { body: JSON.stringify(init.json) }),
    });

  const signUp = (email: string, language?: string) =>
    call('/api/auth/sign-up/email', {
      json: { name: 'Ana', email, password: PASSWORD },
      ...(language ? { language } : {}),
    });
  const signIn = (email: string, password = PASSWORD) =>
    call('/api/auth/sign-in/email', { json: { email, password } });
  const resend = (email: string, ip?: string) =>
    call('/api/auth/send-verification-email', {
      json: { email, callbackURL: '/' },
      ...(ip ? { ip } : {}),
    });
  const requestReset = (email: string, ip?: string) =>
    call('/api/auth/request-password-reset', {
      json: { email, redirectTo: `${origin}/reset-password` },
      ...(ip ? { ip } : {}),
    });
  const session = async (cookie: string) =>
    (await (await call('/api/auth/get-session', { cookie })).json()) as {
      user?: { email: string };
    } | null;

  /** Follows the verification link from the first email and returns the session cookie it opens. */
  async function verify(email: string) {
    const [mail] = await waitForMails(email);
    const response = await call(pathOf(linkIn(mail!.text)));
    return { response, cookie: cookieOf(response) };
  }

  return { database, app, origin, call, signUp, signIn, resend, requestReset, session, verify };
}

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');

const json = async (response: Response) => (await response.json()) as Record<string, unknown>;

/** Nothing the process wrote to its log may contain a token or an address. */
function expectCleanLogs(...secrets: string[]) {
  const text = logged.join('\n');
  for (const secret of secrets) expect(text).not.toContain(secret);
  expect(text).not.toMatch(/token=|@example\.test|correct horse|a completely different/);
}

describe('verification email', () => {
  it('is delivered on sign-up, in the language of the sign-up, with a link that works', async () => {
    const { signUp, call, session, signIn } = await harness();
    const email = randomAddress('ana');

    const response = await signUp(email, 'pt-BR');
    expect(response.status).toBe(200);
    // Not signed in yet: the address is unverified.
    expect(cookieOf(response)).toBe('');
    expect((await json(response)).token).toBeNull();

    const [mail] = await waitForMails(email);
    expect(mail?.subject).toBe(catalogs['pt-BR'].email.verifyEmail.subject);
    expect(mail?.text).toContain(catalogs['pt-BR'].email.verifyEmail.body);
    expect(mail?.html).toContain('<html lang="pt-BR">');
    expect(mail?.from).toBe('Globetrot <hello@globetrot.local>');
    expect(mail?.to).toEqual([email]);

    // The password does not work until the link has been followed.
    const refused = await signIn(email);
    expect(refused.status).toBe(403);
    expect(await json(refused)).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    const link = linkIn(mail!.text);
    const clicked = await call(pathOf(link));
    expect(clicked.status).toBe(302);
    const cookie = cookieOf(clicked);
    expect(cookie).toContain('globetrot.session_token=');
    expect((await session(cookie))?.user?.email).toBe(email);

    // And now it does.
    expect((await signIn(email)).status).toBe(200);
    expectCleanLogs(new URL(link).searchParams.get('token') ?? 'no-token', email);
  });

  it('is in English by default, and plain: one link, no images, no tracking', async () => {
    const { signUp } = await harness();
    const email = randomAddress('ana');
    await signUp(email);
    const [mail] = await waitForMails(email);
    expect(mail?.subject).toBe(catalogs.en.email.verifyEmail.subject);
    expect(mail?.html).not.toMatch(/<img|<script|src=/i);
    expect(mail?.text).toContain('24 hours');
  });

  it('works once: following the link again changes nothing and signs nobody in', async () => {
    const { signUp, verify, call } = await harness();
    const email = randomAddress('ana');
    await signUp(email);
    const first = await verify(email);
    expect(first.cookie).toContain('session_token');

    const [mail] = await mailsFor(email);
    const again = await call(pathOf(linkIn(mail!.text)));
    expect(again.status).toBe(302);
    expect(cookieOf(again)).toBe('');
  });

  it('is refused once it has expired, and the address stays unverified', async () => {
    const { signUp, call, signIn } = await harness({ VERIFICATION_EXPIRES_IN_SECONDS: '1' });
    const email = randomAddress('ana');
    await signUp(email);
    const [mail] = await waitForMails(email);
    await sleep(2200);

    const clicked = await call(pathOf(linkIn(mail!.text)));
    expect(clicked.status).toBe(302);
    expect(clicked.headers.get('location')).toMatch(/error=/i);
    expect(cookieOf(clicked)).toBe('');
    expect((await signIn(email)).status).toBe(403);
  });

  it('rejects a link whose token was tampered with', async () => {
    const { signUp, call, signIn } = await harness();
    const email = randomAddress('ana');
    await signUp(email);
    const [mail] = await waitForMails(email);
    const link = new URL(linkIn(mail!.text));
    link.searchParams.set('token', `${link.searchParams.get('token')}x`);

    const clicked = await call(`${link.pathname}${link.search}`);
    expect(clicked.headers.get('location')).toMatch(/error=/i);
    expect(cookieOf(clicked)).toBe('');
    expect((await signIn(email)).status).toBe(403);
  });
});

describe('resending the verification email', () => {
  it('delivers a new one, then asks the sender to wait (429 with Retry-After)', async () => {
    const { signUp, resend } = await harness();
    const email = randomAddress('ana');
    await signUp(email);
    await waitForMails(email, 1);

    const first = await resend(email);
    expect(first.status).toBe(200);
    expect(await waitForMails(email, 2)).toHaveLength(2);

    const second = await resend(email);
    expect(second.status).toBe(429);
    expect(await json(second)).toMatchObject({ code: 'EMAIL_COOLDOWN' });
    const wait = Number(second.headers.get('retry-after'));
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(30);
    expect(await mailsAfterWaiting(email, 800)).toHaveLength(2);
  });

  it('applies the cooldown to whoever asks, from any address, and per email address only', async () => {
    const { signUp, resend } = await harness();
    const ana = randomAddress('ana');
    const bruno = randomAddress('bruno');
    await signUp(ana);
    await signUp(bruno);

    expect((await resend(ana, '203.0.113.1')).status).toBe(200);
    // Another client address cannot get around it for the same email.
    expect((await resend(ana, '203.0.113.2')).status).toBe(429);
    // Another email address is not affected.
    expect((await resend(bruno, '203.0.113.2')).status).toBe(200);
  });

  it('answers an unknown address exactly like a known one, and sends nothing to it', async () => {
    const { signUp, resend } = await harness();
    const known = randomAddress('known');
    const unknown = randomAddress('unknown');
    await signUp(known);

    const a = await resend(known);
    const b = await resend(unknown);
    expect(b.status).toBe(a.status);
    expect(await json(b)).toEqual(await json(a));

    // The cooldown cannot tell them apart either.
    const a2 = await resend(known);
    const b2 = await resend(unknown);
    expect([a2.status, b2.status]).toEqual([429, 429]);
    expect(await json(b2)).toEqual(await json(a2));

    expect(await mailsAfterWaiting(unknown)).toEqual([]);
  });

  it('sends nothing to an address that is already verified', async () => {
    const { signUp, verify, resend } = await harness();
    const email = randomAddress('ana');
    await signUp(email);
    await verify(email);
    expect((await resend(email)).status).toBe(200);
    expect(await mailsAfterWaiting(email, 1200)).toHaveLength(1);
  });

  it('limits how many resend requests one client address can make in a minute', async () => {
    const { resend } = await harness({ AUTH_EMAIL_REQUESTS_PER_MINUTE: '2' });
    const ip = '203.0.113.9';
    const statuses: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 3; i++) {
      last = await resend(randomAddress(`n${i}`), ip);
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 429]);
    const wait = Number(last?.headers.get('retry-after'));
    expect(Number.isInteger(wait)).toBe(true);
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(60);
  });
});

describe('password reset', () => {
  async function verifiedAccount(h: Awaited<ReturnType<typeof harness>>, language?: string) {
    const email = randomAddress('ana');
    await h.signUp(email, language);
    const { cookie } = await h.verify(email);
    return { email, cookie };
  }

  it('answers a known and an unknown address identically, and only the known one gets mail', async () => {
    const h = await harness();
    const { email: known } = await verifiedAccount(h);
    const unknown = randomAddress('nobody');

    const a = await h.requestReset(known);
    const b = await h.requestReset(unknown);
    expect(a.status).toBe(200);
    expect(b.status).toBe(a.status);
    expect(await json(b)).toEqual(await json(a));
    expect([...b.headers.keys()].sort()).toEqual([...a.headers.keys()].sort());

    const mails = await waitForMails(known, 2);
    expect(mails.at(-1)?.subject).toBe(catalogs.en.email.resetPassword.subject);
    expect(await mailsAfterWaiting(unknown)).toEqual([]);
  });

  it('lets the new password in, shuts the old one out, and signs every other session out', async () => {
    const h = await harness();
    const { email, cookie: first } = await verifiedAccount(h);
    // A second device: another session of the same account.
    const second = cookieOf(await h.signIn(email));
    expect((await h.session(first))?.user?.email).toBe(email);
    expect((await h.session(second))?.user?.email).toBe(email);

    await h.requestReset(email);
    const reset = (await waitForMails(email, 2)).at(-1)!;
    expect(reset.text).toContain('1 hour');
    const link = linkIn(reset.text);

    // The link checks the token and sends the browser to the reset page with it.
    const landing = await h.call(pathOf(link));
    expect(landing.status).toBe(302);
    const target = new URL(landing.headers.get('location') ?? '');
    expect(target.pathname).toBe('/reset-password');
    const token = target.searchParams.get('token');
    expect(token).toBeTruthy();

    const done = await h.call('/api/auth/reset-password', {
      json: { newPassword: NEW_PASSWORD, token },
    });
    expect(done.status).toBe(200);

    expect((await h.signIn(email, PASSWORD)).status).toBe(401);
    expect((await h.signIn(email, NEW_PASSWORD)).status).toBe(200);
    expect(await h.session(first)).toBeNull();
    expect(await h.session(second)).toBeNull();
    expectCleanLogs(token ?? 'no-token', email, NEW_PASSWORD);
  });

  it('works once: the same token is refused the second time', async () => {
    const h = await harness();
    const { email } = await verifiedAccount(h);
    await h.requestReset(email);
    const reset = (await waitForMails(email, 2)).at(-1)!;
    const landing = await h.call(pathOf(linkIn(reset.text)));
    const token = new URL(landing.headers.get('location') ?? '').searchParams.get('token');

    expect(
      (await h.call('/api/auth/reset-password', { json: { newPassword: NEW_PASSWORD, token } }))
        .status,
    ).toBe(200);
    const again = await h.call('/api/auth/reset-password', {
      json: { newPassword: 'yet another passphrase', token },
    });
    expect(again.status).toBe(400);
    expect(await json(again)).toMatchObject({ code: 'INVALID_TOKEN' });
    expect((await h.signIn(email, NEW_PASSWORD)).status).toBe(200);

    // The link itself no longer leads to the reset page either.
    const reused = await h.call(pathOf(linkIn(reset.text)));
    expect(reused.headers.get('location')).toMatch(/error=INVALID_TOKEN/);
  });

  it('is refused once it has expired, and the old password keeps working', async () => {
    const h = await harness({ RESET_PASSWORD_EXPIRES_IN_SECONDS: '1' });
    const { email } = await verifiedAccount(h);
    await h.requestReset(email);
    const reset = (await waitForMails(email, 2)).at(-1)!;
    const landing = await h.call(pathOf(linkIn(reset.text)));
    const token = new URL(landing.headers.get('location') ?? '').searchParams.get('token');
    await sleep(2200);

    const late = await h.call('/api/auth/reset-password', {
      json: { newPassword: NEW_PASSWORD, token },
    });
    expect(late.status).toBe(400);
    expect(await json(late)).toMatchObject({ code: 'INVALID_TOKEN' });
    expect((await h.call(pathOf(linkIn(reset.text)))).headers.get('location')).toMatch(
      /error=INVALID_TOKEN/,
    );
    expect((await h.signIn(email, PASSWORD)).status).toBe(200);
  });

  it('rejects a token that was never issued', async () => {
    const h = await harness();
    const response = await h.call('/api/auth/reset-password', {
      json: { newPassword: NEW_PASSWORD, token: 'not-a-real-token' },
    });
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('asks for a pause before the next email to the same address, known or not', async () => {
    const h = await harness();
    const { email } = await verifiedAccount(h);
    const unknown = randomAddress('nobody');

    expect((await h.requestReset(email)).status).toBe(200);
    expect((await h.requestReset(unknown)).status).toBe(200);
    const again = await h.requestReset(email);
    const againUnknown = await h.requestReset(unknown);
    expect([again.status, againUnknown.status]).toEqual([429, 429]);
    expect(Number(again.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(await json(again)).toEqual(await json(againUnknown));
    expect(await waitForMails(email, 2)).toHaveLength(2); // the verification email and one reset
  });

  it('is written in the language stored in the settings, whatever the cookie says', async () => {
    const h = await harness();
    const email = randomAddress('ana');
    await h.signUp(email, 'pt-BR');
    const { cookie } = await h.verify(email);
    // The person switches the app to English in the settings.
    const patched = await h.call('/v1/me/preferences', {
      method: 'PATCH',
      json: { locale: 'en' },
      cookie,
    });
    expect(patched.status).toBe(200);

    await h.call('/api/auth/request-password-reset', {
      json: { email, redirectTo: `${h.origin}/reset-password` },
      language: 'pt-BR',
    });
    const mails = await waitForMails(email, 2);
    expect(mails[0]?.subject).toBe(catalogs['pt-BR'].email.verifyEmail.subject);
    expect(mails[1]?.subject).toBe(catalogs.en.email.resetPassword.subject);
  });
});

describe('when the mail server is down', () => {
  it('still creates the account, and logs only an error code', async () => {
    // Nothing listens on port 1.
    const h = await harness({ SMTP_PORT: '1' });
    const email = randomAddress('ana');

    const response = await h.signUp(email);
    expect(response.status).toBe(200);

    const deadline = Date.now() + 8000;
    while (!logged.some((line) => line.includes('could not send')) && Date.now() < deadline) {
      await sleep(50);
    }
    expect(logged.filter((line) => line.includes('could not send'))).toEqual([
      expect.stringMatching(
        /^could not send the verifyEmail email \((ECONNREFUSED|ESOCKET|ETIMEDOUT)\)$/,
      ),
    ]);
    expectCleanLogs(email);
    // Without Sentry configured the failure is still counted for the dashboard (#204).
    const counted = async () =>
      (await createMetricsRepository(h.database.db).snapshot(new Date())).emailFailures.verifyEmail;
    const until = Date.now() + 3000;
    while ((await counted()).last7 === 0 && Date.now() < until) await sleep(50);
    expect(await counted()).toEqual({ last7: 1, last30: 1 });
  });

  it('reports the failure with only the email type and code, counts it, and answers as if sent', async () => {
    const database = await createTestDatabase();
    databases.push(database);
    const config = loadApiConfig({
      NODE_ENV: 'test',
      DATABASE_URL: database.url,
      BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    });
    const reports: Error[] = [];
    const { app } = createServices(database.db, config, {
      email: {
        async send(message) {
          // A provider error that quotes the address and the link: none of it may leave.
          throw Object.assign(new Error(`rejected ${message.to} ${message.data.url}`), {
            code: 'EENVELOPE',
          });
        },
      },
      reportError: (error) => reports.push(error),
    });
    const origin = config.auth.baseURL;
    const email = randomAddress('down');
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ name: 'Ana', email, password: PASSWORD }),
    });
    // The same answer as a sign-up whose email went out.
    expect(response.status).toBe(200);
    expect((await json(response)).token).toBeNull();

    const deadline = Date.now() + 5000;
    while (reports.length === 0 && Date.now() < deadline) await sleep(50);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.name).toBe('EmailDeliveryFailed');
    expect(reports[0]!.message).toBe('verifyEmail email not sent (EENVELOPE)');

    const until = Date.now() + 3000;
    let events: (typeof schema.auditEvent.$inferSelect)[] = [];
    while (events.length === 0 && Date.now() < until) {
      events = await database.db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.action, 'email.failed'));
      if (events.length === 0) await sleep(50);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.metadata).toEqual({ template: 'verifyEmail', code: 'EENVELOPE' });
    expect(JSON.stringify(events)).not.toContain(email);
    const snapshot = await createMetricsRepository(database.db).snapshot(new Date());
    expect(snapshot.emailFailures).toEqual({
      verifyEmail: { last7: 1, last30: 1 },
      resetPassword: { last7: 0, last30: 0 },
    });
    expectCleanLogs(email);
  });
});
