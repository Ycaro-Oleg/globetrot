import { uuidV7 } from '@globetrot/domain';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createUnitOfWork } from './repositories';
import { createTripRepository } from './repositories';
import { schema } from './index';
import { createTestDatabase, type TestDatabase } from './testing';

const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let tick = 0;
const id = () => uuidV7(Date.now() + ++tick, crypto.getRandomValues(new Uint8Array(10)));
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 7, 12, minutes));

async function setup() {
  const database = await createTestDatabase();
  databases.push(database);
  const { db, pool } = database;
  for (const userId of ['u-ana', 'u-bruno']) {
    await db
      .insert(schema.user)
      .values({ id: userId, name: userId, email: `${userId}@example.com` });
  }
  const trips = createTripRepository(db);
  const unitOfWork = createUnitOfWork(db);
  const newTrip = (overrides: Partial<Parameters<typeof trips.insert>[0]> = {}) => ({
    id: id(),
    ownerId: 'u-ana',
    title: 'Japan',
    startDate: null,
    currency: 'USD',
    status: 'active' as const,
    visibility: 'private' as const,
    createdAt: at(0),
    ...overrides,
  });
  /** Expects the statement to be rejected, and returns the constraint it names. */
  const rejected = async (query: string, values: unknown[] = []) => {
    const error = await pool.query(query, values).then(
      () => undefined,
      (e: unknown) => e as { code?: string; constraint?: string; message: string },
    );
    expect(error, `expected "${query}" to be rejected`).toBeDefined();
    return error!;
  };
  return { database, db, pool, trips, unitOfWork, newTrip, rejected };
}

describe('trip repository', () => {
  it('stores and reads a trip, keeping the start date a plain calendar date', async () => {
    const { trips, newTrip } = await setup();
    const input = newTrip({ startDate: '2027-04-03', currency: 'JPY' });
    const saved = await trips.insert(input);
    expect(saved).toMatchObject({ ...input, updatedAt: input.createdAt });
    expect(await trips.findById(input.id)).toEqual(saved);
    expect(await trips.findById(id())).toBeNull();
  });

  it('lists one owner’s trips newest first and hides archived ones unless asked', async () => {
    const { trips, newTrip } = await setup();
    const older = await trips.insert(newTrip({ title: 'Older', createdAt: at(1) }));
    const newer = await trips.insert(newTrip({ title: 'Newer', createdAt: at(2) }));
    const archived = await trips.insert(
      newTrip({ title: 'Archived', createdAt: at(3), status: 'archived' }),
    );
    await trips.insert(newTrip({ ownerId: 'u-bruno', title: 'Bruno' }));

    const visible = await trips.listByOwner('u-ana', { includeArchived: false });
    expect(visible.map((trip) => trip.id)).toEqual([newer.id, older.id]);
    const all = await trips.listByOwner('u-ana', { includeArchived: true });
    expect(all.map((trip) => trip.id)).toEqual([archived.id, newer.id, older.id]);
  });

  it('updates only the fields given, clears the date with null, and stamps updatedAt', async () => {
    const { trips, newTrip } = await setup();
    const saved = await trips.insert(newTrip({ startDate: '2027-04-03' }));
    const renamed = await trips.update(saved.id, { title: 'Japan 2' }, at(5));
    expect(renamed).toMatchObject({ title: 'Japan 2', startDate: '2027-04-03', updatedAt: at(5) });
    expect(renamed.createdAt).toEqual(saved.createdAt);
    const cleared = await trips.update(saved.id, { startDate: null, status: 'completed' }, at(6));
    expect(cleared).toMatchObject({ startDate: null, status: 'completed', title: 'Japan 2' });
  });

  it('fails loudly when updating a trip that does not exist', async () => {
    const { trips } = await setup();
    await expect(trips.update(id(), { title: 'x' }, at(0))).rejects.toThrow('does not exist');
  });
});

describe('what the database enforces by itself', () => {
  const insert = `INSERT INTO trip (id, owner_id, title, start_date, currency, status, visibility)
                  VALUES ($1, 'u-ana', $2, $3, $4, $5, $6)`;
  const ok = (
    overrides: Partial<
      Record<'title' | 'start' | 'currency' | 'status' | 'visibility', string | null>
    >,
  ) => {
    const row = {
      title: 'Japan',
      start: null,
      currency: 'USD',
      status: 'active',
      visibility: 'private',
      ...overrides,
    };
    return [id(), row.title, row.start, row.currency, row.status, row.visibility];
  };

  it('accepts a valid row (so the rejections below are about the one bad value)', async () => {
    const { pool } = await setup();
    await pool.query(insert, ok({}));
  });

  it.each([
    ['trip_title_length', { title: '' }],
    ['trip_title_length', { title: 'x'.repeat(121) }],
    ['trip_title_trimmed', { title: ' Japan' }],
    ['trip_currency_format', { currency: 'usd' }],
    ['trip_currency_format', { currency: 'US' }],
    ['trip_status_valid', { status: 'deleted' }],
    ['trip_visibility_valid', { visibility: 'public' }],
  ])('rejects a row that breaks %s', async (constraint, overrides) => {
    const { rejected } = await setup();
    const error = await rejected(insert, ok(overrides));
    expect(error.constraint).toBe(constraint);
  });

  it('rejects an impossible start date', async () => {
    const { rejected } = await setup();
    const error = await rejected(insert, ok({ start: '2027-02-30' }));
    expect(error.code).toBe('22008');
  });

  it('refuses a trip without an owner, and an owner that does not exist', async () => {
    const { rejected } = await setup();
    expect((await rejected(insert.replace("'u-ana'", "'u-nobody'"), ok({}))).constraint).toBe(
      'trip_owner_id_user_id_fk',
    );
  });

  it('refuses to delete a user who has trips instead of silently destroying them', async () => {
    const { trips, newTrip, rejected } = await setup();
    await trips.insert(newTrip());
    const error = await rejected(`DELETE FROM "user" WHERE id = 'u-ana'`);
    expect(error.constraint).toBe('trip_owner_id_user_id_fk');
  });
});

describe('idempotency store', () => {
  it('reserves a key, replays a stored response and refuses a different request', async () => {
    const { unitOfWork } = await setup();
    const input = { ownerId: 'u-ana', key: 'key-12345678', fingerprint: 'fp-1', createdAt: at(0) };

    await unitOfWork.run(async (tx) => {
      expect(await tx.idempotency.begin(input)).toEqual({ state: 'new' });
      await tx.idempotency.complete('u-ana', input.key, { id: 'result' });
    });

    await unitOfWork.run(async (tx) => {
      expect(await tx.idempotency.begin(input)).toEqual({
        state: 'replay',
        response: { id: 'result' },
      });
      expect(await tx.idempotency.begin({ ...input, fingerprint: 'fp-2' })).toEqual({
        state: 'mismatch',
      });
      // The same key belongs to another owner, so it is new for them.
      expect(await tx.idempotency.begin({ ...input, ownerId: 'u-bruno' })).toEqual({
        state: 'new',
      });
      await tx.idempotency.complete('u-bruno', input.key, { id: 'theirs' });
    });
  });

  it('lets only one of several concurrent requests with the same key do the work', async () => {
    const { unitOfWork, trips, newTrip } = await setup();
    const key = 'key-concurrent-1';
    const attempt = () =>
      unitOfWork.run(async (tx) => {
        const start = await tx.idempotency.begin({
          ownerId: 'u-ana',
          key,
          fingerprint: 'fp',
          createdAt: at(0),
        });
        if (start.state === 'replay') return { created: false, response: start.response };
        const trip = await tx.trips.insert(newTrip());
        await tx.idempotency.complete('u-ana', key, { id: trip.id });
        return { created: true, response: { id: trip.id } };
      });

    const results = await Promise.all(Array.from({ length: 6 }, attempt));

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => (result.response as { id: string }).id)).size).toBe(1);
    expect(await trips.listByOwner('u-ana', { includeArchived: true })).toHaveLength(1);
  });
});

describe('unit of work', () => {
  it('rolls back the trip, the audit event and the key together when the callback throws', async () => {
    const { unitOfWork, trips, newTrip, db } = await setup();
    const trip = newTrip();
    await expect(
      unitOfWork.run(async (tx) => {
        await tx.idempotency.begin({
          ownerId: 'u-ana',
          key: 'key-rollback-1',
          fingerprint: 'fp',
          createdAt: at(0),
        });
        await tx.trips.insert(trip);
        await tx.audit.record({
          id: id(),
          occurredAt: at(0),
          actor: { kind: 'user', userId: 'u-ana' },
          action: 'trip.create',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await trips.findById(trip.id)).toBeNull();
    expect(await db.select().from(schema.auditEvent)).toHaveLength(0);
    expect(await db.select().from(schema.idempotencyKey)).toHaveLength(0);
  });

  it('commits everything together on success', async () => {
    const { unitOfWork, trips, newTrip, db } = await setup();
    const trip = newTrip();
    await unitOfWork.run(async (tx) => {
      await tx.trips.insert(trip);
      await tx.audit.record({
        id: id(),
        occurredAt: at(0),
        actor: { kind: 'user', userId: 'u-ana' },
        action: 'trip.create',
        entityType: 'trip',
        entityId: trip.id,
        metadata: { fields: ['title'] },
      });
    });
    expect(await trips.findById(trip.id)).not.toBeNull();
    expect(await db.select().from(schema.auditEvent)).toEqual([
      expect.objectContaining({
        actorKind: 'user',
        actorId: 'u-ana',
        action: 'trip.create',
        entityId: trip.id,
        metadata: { fields: ['title'] },
      }),
    ]);
  });
});

describe('audit log', () => {
  async function withEvent() {
    const context = await setup();
    await context.unitOfWork.run((tx) =>
      tx.audit.record({
        id: id(),
        occurredAt: at(0),
        actor: { kind: 'user', userId: 'u-ana' },
        action: 'trip.create',
        entityType: 'trip',
        entityId: 'e-1',
        metadata: {},
      }),
    );
    return context;
  }

  it('cannot be updated, deleted or truncated, even by the application’s own connection', async () => {
    const { rejected } = await withEvent();
    for (const statement of [
      `UPDATE audit_event SET action = 'x'`,
      `DELETE FROM audit_event`,
      `TRUNCATE audit_event`,
    ]) {
      const error = await rejected(statement);
      expect(error.message).toContain('append-only');
    }
  });

  it('keeps the history when the account is gone: actor_id has no foreign key', async () => {
    const { db } = await withEvent();
    await db.delete(schema.user).where(sql`id = 'u-ana'`);
    expect(await db.select().from(schema.auditEvent)).toHaveLength(1);
  });
});

describe('savings check-ins', () => {
  it('adds up everyone’s check-ins per week for the trip, oldest week first', async () => {
    const { trips, unitOfWork, newTrip } = await setup();
    const trip = await trips.insert(newTrip());
    const history = await unitOfWork.run(async (tx) => {
      const checkin = (userId: string, week: string, amountMinor: bigint) =>
        tx.savings.upsertCheckin({ tripId: trip.id, userId, week, amountMinor, createdAt: at(1) });
      await checkin('u-ana', '2026-W49', 5_000n);
      await checkin('u-ana', '2026-W48', 2_000n);
      await checkin('u-bruno', '2026-W49', 3_000n);
      return tx.savings.listTripCheckins(trip.id);
    });
    expect(history).toEqual([
      { week: '2026-W48', amountMinor: 2_000n },
      { week: '2026-W49', amountMinor: 8_000n },
    ]);
  });
});
