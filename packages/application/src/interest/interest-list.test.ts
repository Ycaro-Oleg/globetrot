import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createFakeEmail } from '../testing/fake-email';
import { ValidationError } from '../errors';
import {
  createInterestList,
  type InterestEntryRow,
  type InterestListStore,
  type InterestListTransaction,
} from './interest-list';

const KEY = 'unit-test-key';
const hasher = {
  mac: (value: string) => createHmac('sha256', KEY).update(value).digest('base64url'),
  digest: (value: string) => createHash('sha256').update(value).digest('hex'),
  equal: (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
};

/** An in-memory store with the same rules as the SQL one. */
function memoryStore() {
  const entries = new Map<string, InterestEntryRow>();
  const suppressed = new Map<string, Date>();
  const days = new Map<string, number>();
  const audit: { action: string; entityId: string; metadata: Record<string, unknown> }[] = [];
  const tx: InterestListTransaction = {
    async isSuppressed(hash) {
      return suppressed.has(hash);
    },
    async findByEmail(email) {
      return [...entries.values()].find((entry) => entry.email === email) ?? null;
    },
    async findById(id) {
      return entries.get(id) ?? null;
    },
    async insert(row) {
      if ([...entries.values()].some((entry) => entry.email === row.email)) return false;
      entries.set(row.id, row);
      return true;
    },
    async update(id, patch) {
      const entry = entries.get(id);
      if (entry) entries.set(id, { ...entry, ...patch });
    },
    async remove(id) {
      entries.delete(id);
    },
    async suppress(hash, at) {
      if (!suppressed.has(hash)) suppressed.set(hash, at);
    },
    async countEmail(day) {
      const next = (days.get(day) ?? 0) + 1;
      days.set(day, next);
      return next;
    },
    async audit(event) {
      audit.push({ action: event.action, entityId: event.entityId, metadata: event.metadata });
    },
  };
  const store: InterestListStore = { transaction: (work) => work(tx) };
  return { store, entries, suppressed, audit };
}

function setup(options: { cap?: number; admins?: string[] } = {}) {
  const memory = memoryStore();
  const email = createFakeEmail();
  let now = new Date('2026-11-28T12:00:00.000Z');
  let counter = 0;
  const tasks: Promise<void>[] = [];
  const logs: string[] = [];
  const list = createInterestList({
    store: memory.store,
    email: email.port,
    clock: { now: () => now },
    ids: {
      newId: () => `0190f0f0-0000-7000-8000-${String(++counter).padStart(12, '0')}`,
      newToken: () => `secret${String(++counter).padStart(16, '0')}`,
    },
    hasher,
    links: {
      confirmPage: (token, locale) =>
        `https://web.example.test/list/confirm?token=${token}&lang=${locale}`,
      unsubscribePage: (token, locale) =>
        `https://web.example.test/list/unsubscribe?token=${token}&lang=${locale}`,
      oneClick: (token) => `https://web.example.test/v1/leads/unsubscribe?token=${token}`,
    },
    isInternal: (address) => (options.admins ?? []).includes(address),
    dailyEmailCap: options.cap ?? 50,
    background: (task) => {
      tasks.push(task());
    },
    log: (message) => logs.push(message),
  });
  return {
    ...memory,
    list,
    email,
    logs,
    settle: () => Promise.all(tasks.splice(0)),
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

const HOUR = 60 * 60 * 1000;
const join = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  locale: 'pt-BR',
  consent: true,
  source: 'landing',
  ...extra,
});
const tokenIn = (url: string) => new URL(url).searchParams.get('token') ?? '';

describe('join', () => {
  it('stores the entry and sends one confirmation in the person’s language, with unsubscribe', async () => {
    const t = setup();
    expect(
      await t.list.join(
        join('Visitor@Mail.Dev', {
          origin: { utm_source: 'x', referrer_domain: 'T.co', landing_path: '/roteiros/japao' },
        }),
      ),
    ).toEqual({ accepted: true });
    await t.settle();
    const [entry] = [...t.entries.values()];
    expect(entry).toMatchObject({
      email: 'visitor@mail.dev',
      locale: 'pt-BR',
      source: 'landing',
      utmSource: 'x',
      referrerDomain: 't.co',
      landingPath: '/roteiros/japao',
      confirmedAt: null,
      internal: false,
      sendsInWindow: 1,
    });
    expect(entry!.confirmHash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.email.sent).toHaveLength(1);
    const message = t.email.sent[0]!;
    expect(message).toMatchObject({
      to: 'visitor@mail.dev',
      template: 'interestConfirm',
      locale: 'pt-BR',
    });
    expect(message.data.name).toBe('');
    expect(message.data.unsubscribeUrl).toContain('/list/unsubscribe?token=');
    expect(message.listUnsubscribe).toContain('/v1/leads/unsubscribe?token=');
    // The stored hash is not the secret in the link.
    expect(tokenIn(message.data.url)).not.toContain(entry!.confirmHash!);
  });

  it('refuses a missing or false consent, a bad address and an origin with a query', async () => {
    const t = setup();
    await expect(t.list.join({ ...join('a@mail.dev'), consent: undefined })).rejects.toThrow(
      ValidationError,
    );
    await expect(t.list.join(join('a@mail.dev', { consent: false }))).rejects.toThrow(
      ValidationError,
    );
    await expect(t.list.join(join('not-an-address'))).rejects.toThrow(ValidationError);
    await expect(
      t.list.join(join('a@mail.dev', { origin: { landing_path: '/p?email=a@mail.dev' } })),
    ).rejects.toThrow(ValidationError);
    await expect(
      t.list.join(join('a@mail.dev', { origin: { referrer_domain: 'https://t.co/x' } })),
    ).rejects.toThrow(ValidationError);
    expect(t.entries.size).toBe(0);
  });

  it('answers the same for a repeat and sends at most 3 confirmations a day per address', async () => {
    const t = setup();
    for (let i = 0; i < 5; i += 1)
      expect(await t.list.join(join('repeat@mail.dev'))).toEqual({ accepted: true });
    await t.settle();
    expect(t.entries.size).toBe(1);
    expect(t.email.sent).toHaveLength(3);
    t.advance(25 * HOUR);
    await t.list.join(join('repeat@mail.dev'));
    await t.settle();
    expect(t.email.sent).toHaveLength(4);
  });

  it('keeps the first visit’s origin on a repeat', async () => {
    const t = setup();
    await t.list.join(join('origin@mail.dev', { origin: { utm_source: 'first' } }));
    await t.list.join(join('origin@mail.dev', { origin: { utm_source: 'second' } }));
    expect([...t.entries.values()][0]!.utmSource).toBe('first');
  });

  it('sends nothing to an address already confirmed', async () => {
    const t = setup();
    await t.list.join(join('done@mail.dev'));
    await t.settle();
    await t.list.confirm({ token: tokenIn(t.email.sent[0]!.data.url) });
    await t.list.join(join('done@mail.dev'));
    await t.settle();
    expect(t.email.sent).toHaveLength(1);
  });

  it('stops at the daily ceiling for the whole list and logs only the count', async () => {
    const t = setup({ cap: 2 });
    for (const name of ['a', 'b', 'c']) await t.list.join(join(`${name}@mail.dev`));
    await t.settle();
    expect(t.email.sent).toHaveLength(2);
    expect(t.entries.size).toBe(3);
    expect(t.logs).toEqual(['interest list: daily email ceiling reached (3 today)']);
  });

  it('marks internal entries from the flag or the address rule', async () => {
    const t = setup({ admins: ['owner@team.dev'] });
    await t.list.join(join('owner@team.dev'));
    await t.list.join(join('device@mail.dev', { internal: true }));
    await t.list.join(join('visitor@mail.dev'));
    const internal = Object.fromEntries([...t.entries.values()].map((e) => [e.email, e.internal]));
    expect(internal).toEqual({
      'owner@team.dev': true,
      'device@mail.dev': true,
      'visitor@mail.dev': false,
    });
  });

  it('never puts the address in the audit metadata or the logs', async () => {
    const t = setup({ cap: 0 });
    await t.list.join(join('private@mail.dev'));
    expect(JSON.stringify(t.audit)).not.toContain('private');
    expect(t.logs.join(' ')).not.toContain('private');
  });

  it('logs only a code when the email fails', async () => {
    const t = setup();
    t.email.fail(Object.assign(new Error('to private@mail.dev'), { code: 'ECONNREFUSED' }));
    await t.list.join(join('private@mail.dev'));
    await t.settle();
    expect(t.logs).toEqual(['interest list: confirmation email failed (ECONNREFUSED)']);
  });
});

describe('confirm', () => {
  it('confirms once, then says already confirmed', async () => {
    const t = setup();
    await t.list.join(join('c@mail.dev'));
    await t.settle();
    const token = tokenIn(t.email.sent[0]!.data.url);
    expect(await t.list.confirm({ token })).toEqual({ result: 'confirmed', internal: false });
    expect(await t.list.confirm({ token })).toEqual({
      result: 'already_confirmed',
      internal: false,
    });
    expect([...t.entries.values()][0]!.confirmedAt).not.toBeNull();
  });

  it('says expired after 48 hours', async () => {
    const t = setup();
    await t.list.join(join('late@mail.dev'));
    await t.settle();
    t.advance(49 * HOUR);
    expect(await t.list.confirm({ token: tokenIn(t.email.sent[0]!.data.url) })).toEqual({
      result: 'expired',
      internal: false,
    });
  });

  it('says not found for a wrong secret, an unknown entry or a token without an id', async () => {
    const t = setup();
    await t.list.join(join('n@mail.dev'));
    await t.settle();
    const token = tokenIn(t.email.sent[0]!.data.url);
    const [id] = token.split('.');
    expect(await t.list.confirm({ token: `${id}.wrongwrongwrongwrong` })).toEqual({
      result: 'not_found',
      internal: false,
    });
    expect(
      await t.list.confirm({ token: '0190f0f0-0000-7000-8000-999999999999.abcdefghijkl' }),
    ).toEqual({ result: 'not_found', internal: false });
    expect(await t.list.confirm({ token: 'abcdefghijklmnopqrstuvwxyz' })).toEqual({
      result: 'not_found',
      internal: false,
    });
  });

  it('tells an internal entry, as a boolean', async () => {
    const t = setup();
    await t.list.join(join('qa@mail.dev', { internal: true }));
    await t.settle();
    expect(await t.list.confirm({ token: tokenIn(t.email.sent[0]!.data.url) })).toEqual({
      result: 'confirmed',
      internal: true,
    });
  });

  it('refuses a malformed token', async () => {
    const t = setup();
    await expect(t.list.confirm({ token: 'short' })).rejects.toThrow(ValidationError);
  });
});

describe('leave', () => {
  it('deletes the entry, keeps only a hash, and the list never emails the address again', async () => {
    const t = setup();
    await t.list.join(join('bye@mail.dev'));
    await t.settle();
    const token = tokenIn(t.email.sent[0]!.data.unsubscribeUrl!);
    expect(await t.list.leave({ token })).toEqual({ result: 'unsubscribed' });
    expect(t.entries.size).toBe(0);
    expect(t.suppressed.size).toBe(1);
    expect([...t.suppressed.keys()][0]).not.toContain('bye');
    // Running it twice is fine.
    expect(await t.list.leave({ token })).toEqual({ result: 'unsubscribed' });
    // Signing up again answers the same and sends nothing.
    expect(await t.list.join(join('BYE@mail.dev'))).toEqual({ accepted: true });
    await t.settle();
    expect(t.email.sent).toHaveLength(1);
    expect(t.entries.size).toBe(0);
  });

  it('works from the one-click address too', async () => {
    const t = setup();
    await t.list.join(join('click@mail.dev'));
    await t.settle();
    await t.list.leave({ token: tokenIn(t.email.sent[0]!.listUnsubscribe!) });
    expect(t.entries.size).toBe(0);
  });

  it('answers the same for a forged token and deletes nothing', async () => {
    const t = setup();
    await t.list.join(join('keep@mail.dev'));
    await t.settle();
    const [id] = tokenIn(t.email.sent[0]!.data.url).split('.');
    expect(await t.list.leave({ token: `${id}.forgedforgedforgedforged` })).toEqual({
      result: 'unsubscribed',
    });
    expect(t.entries.size).toBe(1);
  });
});
