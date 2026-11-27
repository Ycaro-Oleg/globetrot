// The trial-email queries against a real PostgreSQL: only verified accounts in the window, without a paid plan,
// once per kind, with the language from preferences.
import { afterEach, describe, expect, it } from 'vitest';
import { createBillingRepository } from './billing-repository';
import { schema } from './index';
import { createNoticeRepository } from './notice-repository';
import { createTestDatabase, type TestDatabase } from './testing';

const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

const NOW = new Date('2026-11-14T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('account notices', () => {
  it('finds verified accounts in the window with no paid plan, and claims each email once', async () => {
    const database = await createTestDatabase();
    databases.push(database);
    const { db } = database;
    const people = [
      { id: 'u-soon', verified: true, signedUp: daysAgo(6) },
      { id: 'u-unverified', verified: false, signedUp: daysAgo(6) },
      { id: 'u-paid', verified: true, signedUp: daysAgo(6) },
      { id: 'u-fresh', verified: true, signedUp: daysAgo(1) },
    ];
    for (const person of people) {
      await db.insert(schema.user).values({
        id: person.id,
        name: person.id,
        email: `${person.id}@example.com`,
        emailVerified: person.verified,
        createdAt: person.signedUp,
      });
    }
    await db.insert(schema.userPreference).values({ userId: 'u-soon', locale: 'pt-BR' });
    await createBillingRepository(db).saveSubscription(
      'u-paid',
      {
        plan: 'explorer',
        interval: 'month',
        status: 'active',
        startedAt: daysAgo(2),
        currentPeriodEnd: daysAgo(-28),
        providerCustomerId: null,
        providerSubscriptionId: null,
      },
      NOW,
    );

    const notices = createNoticeRepository(db);
    const window = { after: daysAgo(7), upTo: daysAgo(5) };
    const due = await notices.due('trial-ending', window, NOW, 10);
    expect(due).toEqual([
      {
        userId: 'u-soon',
        email: 'u-soon@example.com',
        name: 'u-soon',
        locale: 'pt-BR',
        currency: 'USD',
        signedUpAt: daysAgo(6),
        tripTitle: null,
      },
    ]);

    expect(await notices.claim('u-soon', 'trial-ending', NOW)).toBe(true);
    expect(await notices.claim('u-soon', 'trial-ending', NOW)).toBe(false);
    expect(await notices.due('trial-ending', window, NOW, 10)).toEqual([]);
    expect(await notices.due('trial-ended', window, NOW, 10)).toHaveLength(1);
    await notices.release('u-soon', 'trial-ending');
    expect(await notices.due('trial-ending', window, NOW, 10)).toHaveLength(1);
  });

  it('names the trip changed most recently, never an archived one', async () => {
    const database = await createTestDatabase();
    databases.push(database);
    const { db } = database;
    await db.insert(schema.user).values({
      id: 'u-trips',
      name: 'u-trips',
      email: 'u-trips@example.com',
      emailVerified: true,
      createdAt: daysAgo(6),
    });
    const trip = (id: string, title: string, status: string, updatedAt: Date) => ({
      id,
      ownerId: 'u-trips',
      title,
      status,
      currency: 'USD',
      createdAt: daysAgo(6),
      updatedAt,
    });
    await db
      .insert(schema.trip)
      .values([
        trip('00000000-0000-7000-8000-000000000001', 'Lisbon', 'active', daysAgo(5)),
        trip('00000000-0000-7000-8000-000000000002', 'Japan in two weeks', 'active', daysAgo(2)),
        trip('00000000-0000-7000-8000-000000000003', 'Old idea', 'archived', daysAgo(1)),
      ]);
    const [target] = await createNoticeRepository(db).due(
      'trial-ending',
      { after: daysAgo(7), upTo: daysAgo(5) },
      NOW,
      10,
    );
    expect(target?.tripTitle).toBe('Japan in two weeks');
  });
});

describe('weekly reminders', () => {
  it('finds people saving monthly with the reminder on and no check-in this week, once per week', async () => {
    const { createWeeklyNoticeRepository } = await import('./notice-repository');
    const database = await createTestDatabase();
    databases.push(database);
    const { db } = database;
    for (const id of ['u-saver', 'u-off', 'u-done', 'u-idle']) {
      await db.insert(schema.user).values({
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: true,
      });
    }
    await db.insert(schema.userPreference).values({ userId: 'u-off', weeklyReminder: false });
    const trips: string[] = [];
    for (const [index, owner] of ['u-saver', 'u-off', 'u-done', 'u-idle'].entries()) {
      const id = `01a1c28d-afc9-7767-af40-c937c80d00${index}0`;
      trips.push(id);
      await db.insert(schema.trip).values({
        id,
        ownerId: owner,
        title: `Trip ${owner}`,
        currency: 'BRL',
        status: 'active',
        visibility: 'private',
      });
      if (owner !== 'u-idle') {
        await db.insert(schema.tripSavings).values({ tripId: id, monthlyMinor: 50_000n });
      }
    }
    await db.insert(schema.savingsCheckin).values({
      tripId: trips[2]!,
      userId: 'u-done',
      week: '2026-W48',
      amountMinor: 10_000n,
    });
    const notices = createWeeklyNoticeRepository(db);
    const due = await notices.due('2026-W48', 10);
    expect(due.map((target) => [target.userId, target.tripTitle])).toEqual([
      ['u-saver', 'Trip u-saver'],
    ]);
    expect(await notices.claim('u-saver', '2026-W48', NOW)).toBe(true);
    expect(await notices.claim('u-saver', '2026-W48', NOW)).toBe(false);
    expect(await notices.due('2026-W48', 10)).toEqual([]);
    await notices.release('u-saver', '2026-W48');
    expect(await notices.due('2026-W48', 10)).toHaveLength(1);
    expect(await notices.due('2026-W49', 10)).toHaveLength(2);
  });
});

describe('internal metrics', () => {
  it('count accounts, trips by source and paying accounts without returning anyone', async () => {
    const { createMetricsRepository } = await import('./metrics-repository');
    const database = await createTestDatabase();
    databases.push(database);
    const { db } = database;
    await db
      .insert(schema.user)
      .values({ id: 'u-a', name: 'A', email: 'a@example.com', emailVerified: true });
    await db.insert(schema.trip).values({
      id: '01a1c28d-afc9-7767-af40-c937c80dd100',
      ownerId: 'u-a',
      title: 'T',
      currency: 'USD',
      status: 'active',
      visibility: 'private',
    });
    await db.insert(schema.auditEvent).values({
      id: '01a1c28d-afc9-7767-af40-c937c80dd101',
      occurredAt: new Date(),
      actorKind: 'user',
      actorId: 'u-a',
      action: 'trip.create',
      entityType: 'trip',
      entityId: '01a1c28d-afc9-7767-af40-c937c80dd100',
      metadata: { fromSuggestion: 'japan', days: 12 },
    });
    const snapshot = await createMetricsRepository(db).snapshot(new Date());
    expect(snapshot.accounts).toMatchObject({ total: 1, verified: 1 });
    expect(snapshot.trips).toMatchObject({ active: 1, fromPlan30: 1, byHand30: 0 });
    expect(JSON.stringify(snapshot)).not.toContain('a@example.com');
  });
});
