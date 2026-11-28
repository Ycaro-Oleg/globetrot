// The interest list against a real PostgreSQL and Mailpit (ADR-0037): double opt-in, one-click unsubscribe with
// the keyed hash, the same answer whatever the address's state, anti-flooding, the 7-day sweep, and the account's
// export and deletion. Addresses are made up for each test.
import { randomBytes } from 'node:crypto';
import { createMaintenance } from '@globetrot/application';
import { createMaintenanceRepository, schema } from '@globetrot/db';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { catalogs } from '@globetrot/i18n';
import { createMemoryStorage } from '@globetrot/storage';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadApiConfig } from './config';
import {
  headersOf,
  linkIn,
  mailsAfterWaiting,
  pathOf,
  randomAddress,
  waitForMails,
} from './testing/mailpit';
import { createServices } from './wire';

const databases: TestDatabase[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let logged: string[] = [];
beforeEach(() => {
  logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
  }
});

let ipCounter = 0;
const nextIp = () => `198.18.20.${++ipCounter}`;
/** A made-up address outside the reserved test domains, so the entry is not internal. */
const visitor = (prefix: string) =>
  `${prefix}-${randomBytes(5).toString('hex')}@inbox.lead-tests.dev`;

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
  const { app } = createServices(database.db, config, { storage: createMemoryStorage() });
  const origin = config.auth.baseURL;
  const post = (
    path: string,
    body: unknown,
    init: { ip?: string; origin?: string | null; form?: boolean } = {},
  ) =>
    app.request(`${origin}${path}`, {
      method: 'POST',
      headers: {
        ...(init.origin === null ? {} : { origin: init.origin ?? origin }),
        'x-forwarded-for': init.ip ?? nextIp(),
        'content-type': init.form ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      body: init.form ? String(body) : JSON.stringify(body),
    });
  const join = (email: string, extra: Record<string, unknown> = {}, ip?: string) =>
    post(
      '/v1/leads',
      { email, locale: 'pt-BR', consent: true, source: 'landing', ...extra },
      ip ? { ip } : {},
    );
  const entries = () => database.db.select().from(schema.interestListEntry);
  return { database, app, origin, post, join, entries };
}

const tokenOf = (link: string) => new URL(link).searchParams.get('token') ?? '';
const links = (text: string) => [...text.matchAll(/https?:\/\/[^\s"<>]+/g)].map((m) => m[0]);

describe('joining the interest list', () => {
  it('stores the entry without an IP and sends one confirmation in the person’s language, with one-click unsubscribe', async () => {
    const { join, entries, post } = await harness();
    const email = visitor('ana');

    const response = await join(email.toUpperCase(), {
      origin: { utm_source: 'x', referrer_domain: 't.co', landing_path: '/roteiros/japao' },
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });

    const [mail] = await waitForMails(email);
    const copy = catalogs['pt-BR'].email;
    expect(mail!.subject).toBe(copy.interestConfirm.subject);
    expect(mail!.text).toContain(copy.interestConfirm.body);
    expect(mail!.text).toContain(copy.unsubscribe);
    const [confirmLink, unsubscribeLink] = links(mail!.text);
    expect(new URL(confirmLink!).pathname).toBe('/list/confirm');
    expect(new URL(unsubscribeLink!).pathname).toBe('/list/unsubscribe');
    expect(new URL(confirmLink!).searchParams.get('lang')).toBe('pt-BR');

    const headers = await headersOf(mail!.id);
    expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click']);
    expect(headers['List-Unsubscribe']?.[0]).toMatch(
      /^<http:\/\/[^>]+\/v1\/leads\/unsubscribe\?token=/,
    );

    const [row] = await entries();
    expect(row).toMatchObject({
      email,
      locale: 'pt-BR',
      source: 'landing',
      utmSource: 'x',
      referrerDomain: 't.co',
      landingPath: '/roteiros/japao',
      internal: false,
      confirmedAt: null,
    });
    // No column holds an address of the client, and the secret of the link is not stored.
    expect(JSON.stringify(row)).not.toContain('198.18.');
    expect(JSON.stringify(row)).not.toContain(tokenOf(confirmLink!).split('.')[1]);

    const confirm = await post('/v1/leads/confirm', { token: tokenOf(confirmLink!) });
    expect(await confirm.json()).toEqual({ result: 'confirmed', internal: false });
    const again = await post('/v1/leads/confirm', { token: tokenOf(confirmLink!) });
    expect(await again.json()).toEqual({ result: 'already_confirmed', internal: false });
    expect((await entries())[0]!.confirmedAt).not.toBeNull();
  });

  it('refuses a request without consent, and one from an untrusted origin', async () => {
    const { post, entries } = await harness();
    const refused = await post('/v1/leads', {
      email: visitor('no'),
      locale: 'en',
      source: 'landing',
    });
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ field: 'consent' })],
    });
    const hostile = await post(
      '/v1/leads',
      { email: visitor('no'), locale: 'en', consent: true, source: 'landing' },
      { origin: 'https://evil.example' },
    );
    expect(hostile.status).toBe(403);
    expect(await entries()).toEqual([]);
  });

  it('answers the same for a new, a repeated, a confirmed and an unsubscribed address', async () => {
    const { join, post } = await harness();
    const fresh = visitor('fresh');
    const confirmed = visitor('confirmed');
    const gone = visitor('gone');
    await join(confirmed);
    await join(gone);
    const [confirmMail] = await waitForMails(confirmed);
    await post('/v1/leads/confirm', { token: tokenOf(linkIn(confirmMail!.text)) });
    const [goneMail] = await waitForMails(gone);
    await post('/v1/leads/unsubscribe', { token: tokenOf(links(goneMail!.text)[1]!) });

    const answers = await Promise.all(
      [fresh, fresh, confirmed, gone].map(async (email) => {
        const response = await join(email);
        return { status: response.status, body: await response.text() };
      }),
    );
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(answers[0]).toEqual({ status: 202, body: '{"accepted":true}' });
  });

  it('marks a reserved test address as internal and says so on confirm', async () => {
    const { join, post } = await harness();
    const email = randomAddress('qa');
    await join(email);
    const [mail] = await waitForMails(email);
    const confirm = await post('/v1/leads/confirm', { token: tokenOf(linkIn(mail!.text)) });
    expect(await confirm.json()).toEqual({ result: 'confirmed', internal: true });
  });
});

describe('unsubscribing', () => {
  it('works in one click from the mail client, keeps only a hash, and the list never emails the address again', async () => {
    const { join, post, entries, database } = await harness();
    const email = visitor('bye');
    await join(email);
    const [mail] = await waitForMails(email);
    const header = (await headersOf(mail!.id))['List-Unsubscribe']![0]!.slice(1, -1);

    const response = await post(pathOf(header), 'List-Unsubscribe=One-Click', {
      form: true,
      origin: null,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'unsubscribed' });
    expect(await entries()).toEqual([]);
    const suppressed = await database.db.select().from(schema.interestListSuppression);
    expect(suppressed).toHaveLength(1);
    expect(JSON.stringify(suppressed)).not.toContain(email.split('@')[0]!);

    // Twice is fine; signing up again answers the same and sends nothing.
    expect((await post(pathOf(header), 'List-Unsubscribe=One-Click', { form: true })).status).toBe(
      200,
    );
    expect((await join(email)).status).toBe(202);
    expect(await mailsAfterWaiting(email)).toHaveLength(1);
    expect(await entries()).toEqual([]);
  });

  it('answers the same for a forged token and deletes nothing', async () => {
    const { join, post, entries } = await harness();
    const email = visitor('keep');
    await join(email);
    const [mail] = await waitForMails(email);
    const [id] = tokenOf(linkIn(mail!.text)).split('.');
    const forged = await post('/v1/leads/unsubscribe', { token: `${id}.forgedforgedforgedforged` });
    expect(await forged.json()).toEqual({ result: 'unsubscribed' });
    expect(await entries()).toHaveLength(1);
    expect((await post('/v1/leads/unsubscribe', {})).status).toBe(422);
  });
});

describe('anti-flooding', () => {
  it('sends at most 3 confirmations to one address in 24 hours', async () => {
    const { join } = await harness();
    const email = visitor('flood');
    for (let i = 0; i < 5; i += 1) expect((await join(email)).status).toBe(202);
    await waitForMails(email, 3);
    expect(await mailsAfterWaiting(email)).toHaveLength(3);
  });

  it('stops at the daily ceiling for the whole list and logs only the count', async () => {
    const { join } = await harness({ INTEREST_LIST_DAILY_EMAILS: '1' });
    const first = visitor('first');
    const second = visitor('second');
    await join(first);
    await waitForMails(first);
    expect((await join(second)).status).toBe(202);
    expect(await mailsAfterWaiting(second)).toHaveLength(0);
    expect(logged).toContain('interest list: daily email ceiling reached (2 today)');
  });

  it('limits requests per client address', async () => {
    const { join } = await harness();
    const ip = '198.18.30.1';
    for (let i = 0; i < 5; i += 1) expect((await join(visitor('ip'), {}, ip)).status).toBe(202);
    const limited = await join(visitor('ip'), {}, ip);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect((await join(visitor('ip'), {}, '198.18.30.2')).status).toBe(202);
  });
});

describe('retention', () => {
  it('deletes entries never confirmed after 7 days and keeps confirmed ones', async () => {
    const { join, post, entries, database } = await harness();
    const pending = visitor('pending');
    const kept = visitor('kept');
    await join(pending);
    await join(kept);
    const [mail] = await waitForMails(kept);
    await post('/v1/leads/confirm', { token: tokenOf(linkIn(mail!.text)) });
    await database.db
      .update(schema.interestListEntry)
      .set({ createdAt: sql`now() - interval '8 days'` });

    const maintenance = createMaintenance({
      store: createMaintenanceRepository(database.db),
      storage: createMemoryStorage(),
      clock: { now: () => new Date() },
    });
    expect((await maintenance.run()).unconfirmedInterest).toBe(1);
    expect((await entries()).map((row) => row.email)).toEqual([kept]);
  });
});

describe('with an account', () => {
  it('the export includes the entry of the verified email, and deleting the account deletes it', async () => {
    const { app, origin, join, post, entries, database } = await harness({
      REQUIRE_VERIFIED_EMAIL: 'false',
    });
    const email = visitor('member');
    await join(email);
    const [mail] = await waitForMails(email);
    await post('/v1/leads/confirm', { token: tokenOf(linkIn(mail!.text)) });

    const headers = { origin, 'content-type': 'application/json', 'x-forwarded-for': nextIp() };
    const signUp = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Ana', email, password: 'correct horse battery staple' }),
    });
    const cookie = signUp.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const exportOf = async () =>
      (
        (await (
          await app.request(`${origin}/v1/me/export`, { headers: { ...headers, cookie } })
        ).json()) as { data: { interestList: unknown } }
      ).data.interestList;

    // An unverified address does not reach the entry.
    expect(await exportOf()).toBeNull();
    await database.db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.email, email));
    expect(await exportOf()).toMatchObject({ locale: 'pt-BR', source: 'landing' });

    const deleted = await app.request(`${origin}/v1/me`, {
      method: 'DELETE',
      headers: { ...headers, cookie },
      body: JSON.stringify({ confirmEmail: email }),
    });
    expect(deleted.status).toBe(200);
    expect(await entries()).toEqual([]);
  });
});

describe('logs', () => {
  it('and the audit trail never hold an address or a token', async () => {
    const { join, post, database } = await harness({ INTEREST_LIST_DAILY_EMAILS: '1' });
    const email = visitor('quiet');
    await join(email);
    const [mail] = await waitForMails(email);
    await post('/v1/leads/confirm', { token: tokenOf(linkIn(mail!.text)) });
    await join(visitor('over'));
    const text = logged.join('\n');
    expect(text).not.toContain(email);
    expect(text).not.toContain('lead-tests.dev');
    expect(text).not.toMatch(/token=/);
    const audit = await database.db
      .select()
      .from(schema.auditEvent)
      .where(eq(schema.auditEvent.entityType, 'interest_list_entry'));
    expect(audit.map((event) => event.action).sort()).toEqual([
      'interest.confirm',
      'interest.join',
      'interest.join',
    ]);
    expect(audit.every((event) => event.actorKind === 'visitor')).toBe(true);
    expect(JSON.stringify(audit)).not.toContain('lead-tests.dev');
  });
});
