import { describe, expect, it } from 'vitest';
import {
  createApplication,
  IdempotencyKeyReusedError,
  NotFoundError,
  ValidationError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'bruno@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });
const KEY = 'b5f1c0de-6a3e-4c1a-9d52-3a1e8a0b7f10';

function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  return { ...fake, app: createApplication(fake.ports) };
}

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

describe('createTrip', () => {
  it('creates a private, active trip in USD with a trimmed title', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: '  Japan 2027  ' });
    expect(trip).toMatchObject({
      title: 'Japan 2027',
      currency: 'USD',
      status: 'active',
      visibility: 'private',
      startDate: null,
      createdAt: '2026-11-07T12:00:00.000Z',
      updatedAt: '2026-11-07T12:00:00.000Z',
    });
    expect(trip.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.trips.get(trip.id)?.ownerId).toBe('u-ana');
  });

  it('never shows the owner id to the client', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    expect(Object.keys(trip).sort()).toEqual([
      'createdAt',
      'currency',
      'id',
      'startDate',
      'status',
      'title',
      'updatedAt',
      'visibility',
    ]);
  });

  it('accepts a start date and a currency other than USD', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), {
      title: 'Lisboa',
      startDate: '2027-04-03',
      currency: 'EUR',
    });
    expect(trip).toMatchObject({ startDate: '2027-04-03', currency: 'EUR' });
  });

  it.each([
    ['an empty title', { title: '' }, 'title', 'too_small'],
    ['a whitespace-only title', { title: '   \t ' }, 'title', 'too_small'],
    ['a title over 120 characters', { title: 'x'.repeat(121) }, 'title', 'too_big'],
    ['an impossible date', { title: 'T', startDate: '2027-02-30' }, 'startDate', 'invalid_format'],
    [
      'a date with a time',
      { title: 'T', startDate: '2027-04-03T10:00:00Z' },
      'startDate',
      'invalid_format',
    ],
    ['an unknown currency', { title: 'T', currency: 'XXX' }, 'currency', 'custom'],
    ['a lower-case currency', { title: 'T', currency: 'usd' }, 'currency', 'invalid_format'],
    [
      'a short idempotency key',
      { title: 'T', idempotencyKey: 'abc' },
      'idempotencyKey',
      'invalid_format',
    ],
  ])('rejects %s with a stable code', async (_name, input, field, code) => {
    const { app, state } = setup();
    const issues = await issuesOf(app.createTrip.execute(as(ana), input));
    expect(issues).toContainEqual(expect.objectContaining({ field, code }));
    expect(state.trips.size).toBe(0);
  });

  it('accepts a 120-character title', async () => {
    const { app } = setup();
    expect((await app.createTrip.execute(as(ana), { title: 'x'.repeat(120) })).title).toHaveLength(
      120,
    );
  });

  it('ignores a status or owner a client tries to set at creation', async () => {
    const { app, state } = setup();
    const sneaky = { title: 'T', status: 'archived', ownerId: 'u-bruno' } as { title: string };
    const trip = await app.createTrip.execute(as(ana), sneaky);
    expect(trip.status).toBe('active');
    expect(state.trips.get(trip.id)?.ownerId).toBe('u-ana');
  });

  it('writes an audit event with the actor and no trip text', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Secret surprise honeymoon' });
    expect(state.audit).toEqual([
      expect.objectContaining({
        actor: { kind: 'user', userId: 'u-ana' },
        action: 'trip.create',
        entityType: 'trip',
        entityId: trip.id,
        occurredAt: new Date('2026-11-07T12:00:00.000Z'),
        metadata: {},
      }),
    ]);
    expect(JSON.stringify(state.audit)).not.toContain('honeymoon');
  });
});

describe('createTrip idempotency', () => {
  it('returns the original trip for a retry and creates and audits nothing more', async () => {
    const { app, state } = setup();
    const first = await app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY });
    const retry = await app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY });
    expect(retry).toEqual(first);
    expect(state.trips.size).toBe(1);
    expect(state.audit).toHaveLength(1);
  });

  it('treats a spelled-out default the same as an omitted one', async () => {
    const { app, state } = setup();
    const first = await app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY });
    const retry = await app.createTrip.execute(as(ana), {
      title: ' Japan ',
      currency: 'USD',
      startDate: null,
      idempotencyKey: KEY,
    });
    expect(retry.id).toBe(first.id);
    expect(state.trips.size).toBe(1);
  });

  it('refuses the same key with a different payload and changes nothing', async () => {
    const { app, state } = setup();
    await app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY });
    await expect(
      app.createTrip.execute(as(ana), { title: 'Korea', idempotencyKey: KEY }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    await expect(
      app.createTrip.execute(as(ana), { title: 'Japan', currency: 'JPY', idempotencyKey: KEY }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    expect(state.trips.size).toBe(1);
  });

  it('scopes keys to the owner: another user with the same key gets their own trip', async () => {
    const { app, state } = setup();
    const a = await app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY });
    const b = await app.createTrip.execute(as(bruno), { title: 'Japan', idempotencyKey: KEY });
    expect(b.id).not.toBe(a.id);
    expect(state.trips.size).toBe(2);
  });

  it('without a key, every call creates a new trip', async () => {
    const { app, state } = setup();
    await app.createTrip.execute(as(ana), { title: 'Japan' });
    await app.createTrip.execute(as(ana), { title: 'Japan' });
    expect(state.trips.size).toBe(2);
  });

  it('rolls everything back when the audit write fails, so the key stays usable', async () => {
    const { app, state, faults } = setup();
    faults.auditFails = true;
    await expect(
      app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY }),
    ).rejects.toThrow('audit store is down');
    expect(state.trips.size).toBe(0);
    expect(state.idempotency.size).toBe(0);

    faults.auditFails = false;
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan', idempotencyKey: KEY });
    expect(state.trips.get(trip.id)).toBeDefined();
  });
});

describe('listTrips and getTrip', () => {
  it('lists only the caller’s trips, newest first, without archived ones by default', async () => {
    const { app, setNow } = setup();
    setNow(new Date('2026-11-01T00:00:00Z'));
    const older = await app.createTrip.execute(as(ana), { title: 'Older' });
    setNow(new Date('2026-11-02T00:00:00Z'));
    const newer = await app.createTrip.execute(as(ana), { title: 'Newer' });
    const gone = await app.createTrip.execute(as(ana), { title: 'Gone' });
    await app.archiveTrip.execute(as(ana), { id: gone.id });
    await app.createTrip.execute(as(bruno), { title: 'Bruno only' });

    const list = await app.listTrips.execute(as(ana), {});
    expect(list.trips.map((trip) => trip.id)).toEqual([newer.id, older.id]);

    const withArchived = await app.listTrips.execute(as(ana), { includeArchived: true });
    expect(withArchived.trips.map((trip) => trip.title).sort()).toEqual(['Gone', 'Newer', 'Older']);

    expect((await app.listTrips.execute(as(bruno), {})).trips.map((t) => t.title)).toEqual([
      'Bruno only',
    ]);
  });

  it('reads one trip of the caller', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    expect(await app.getTrip.execute(as(ana), { id: trip.id })).toEqual(trip);
  });

  it('treats another user’s trip exactly like a missing one', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    const missing = '00000000-0000-7000-8000-999999999999';
    const other = await app.getTrip.execute(as(bruno), { id: trip.id }).catch((e: unknown) => e);
    const none = await app.getTrip.execute(as(bruno), { id: missing }).catch((e: unknown) => e);
    expect(other).toBeInstanceOf(NotFoundError);
    expect(none).toBeInstanceOf(NotFoundError);
    expect((other as Error).message).toBe((none as Error).message);
  });

  it('rejects an id that is not a UUID', async () => {
    const { app } = setup();
    await issuesOf(app.getTrip.execute(as(ana), { id: 'not-a-uuid' }));
  });
});

describe('updateTrip', () => {
  it('changes only the fields given and stamps updatedAt', async () => {
    const { app, setNow } = setup();
    const trip = await app.createTrip.execute(as(ana), {
      title: 'Japan',
      startDate: '2027-04-03',
    });
    setNow(new Date('2026-11-08T09:00:00.000Z'));
    const updated = await app.updateTrip.execute(as(ana), {
      id: trip.id,
      title: ' Japan & Korea ',
      status: 'traveling',
    });
    expect(updated).toMatchObject({
      title: 'Japan & Korea',
      status: 'traveling',
      startDate: '2027-04-03',
      currency: 'USD',
      createdAt: trip.createdAt,
      updatedAt: '2026-11-08T09:00:00.000Z',
    });
  });

  it('clears the start date with null and sets the currency', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan', startDate: '2027-04-03' });
    const updated = await app.updateTrip.execute(as(ana), {
      id: trip.id,
      startDate: null,
      currency: 'JPY',
    });
    expect(updated).toMatchObject({ startDate: null, currency: 'JPY' });
  });

  it('can restore an archived trip by setting its status', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    await app.archiveTrip.execute(as(ana), { id: trip.id });
    const restored = await app.updateTrip.execute(as(ana), { id: trip.id, status: 'active' });
    expect(restored.status).toBe('active');
  });

  it.each([
    ['nothing to change', {}, '', 'custom'],
    ['an empty title', { title: ' ' }, 'title', 'too_small'],
    ['an unknown status', { status: 'deleted' }, 'status', 'invalid_value'],
    ['an impossible date', { startDate: '2027-13-01' }, 'startDate', 'invalid_format'],
    ['an unknown currency', { currency: 'ZZZ' }, 'currency', 'custom'],
  ])('rejects %s with a stable code and changes nothing', async (_name, change, field, code) => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    const issues = await issuesOf(
      app.updateTrip.execute(as(ana), { id: trip.id, ...change } as never),
    );
    expect(issues).toContainEqual(expect.objectContaining({ field, code }));
    expect(state.trips.get(trip.id)?.title).toBe('Japan');
  });

  it('does not let a client change the owner or the visibility', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    await app.updateTrip.execute(as(ana), {
      id: trip.id,
      title: 'Japan 2',
      ownerId: 'u-bruno',
      visibility: 'public',
    } as never);
    expect(state.trips.get(trip.id)).toMatchObject({ ownerId: 'u-ana', visibility: 'private' });
  });

  it('refuses another user as not found and leaves the trip untouched', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    const before = state.audit.length;
    await expect(
      app.updateTrip.execute(as(bruno), { id: trip.id, title: 'Hacked' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(state.trips.get(trip.id)?.title).toBe('Japan');
    expect(state.audit).toHaveLength(before);
  });

  it('audits the names of the changed fields, never their values', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    await app.updateTrip.execute(as(ana), {
      id: trip.id,
      title: 'Surprise anniversary in Kyoto',
      startDate: '2027-04-03',
      status: 'completed',
    });
    const event = state.audit.at(-1);
    expect(event).toMatchObject({
      action: 'trip.update',
      entityId: trip.id,
      metadata: { fields: ['title', 'startDate', 'status'], status: 'completed' },
    });
    const text = JSON.stringify(state.audit);
    expect(text).not.toContain('anniversary');
    expect(text).not.toContain('2027-04-03');
  });
});

describe('archiveTrip', () => {
  it('archives, audits, and hides the trip from the default list', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    const archived = await app.archiveTrip.execute(as(ana), { id: trip.id });
    expect(archived.status).toBe('archived');
    expect(state.audit.at(-1)).toMatchObject({ action: 'trip.archive', entityId: trip.id });
    expect((await app.listTrips.execute(as(ana), {})).trips).toEqual([]);
  });

  it('is a no-op the second time: same answer, no write, no new audit event', async () => {
    const { app, state, setNow } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    const first = await app.archiveTrip.execute(as(ana), { id: trip.id });
    const events = state.audit.length;
    setNow(new Date('2026-12-01T00:00:00Z'));
    const second = await app.archiveTrip.execute(as(ana), { id: trip.id });
    expect(second).toEqual(first);
    expect(state.audit).toHaveLength(events);
  });

  it('refuses another user as not found and leaves the trip active', async () => {
    const { app, state } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan' });
    await expect(app.archiveTrip.execute(as(bruno), { id: trip.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(state.trips.get(trip.id)?.status).toBe('active');
  });
});
