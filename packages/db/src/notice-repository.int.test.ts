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
        signedUpAt: daysAgo(6),
      },
    ]);

    expect(await notices.claim('u-soon', 'trial-ending', NOW)).toBe(true);
    expect(await notices.claim('u-soon', 'trial-ending', NOW)).toBe(false);
    expect(await notices.due('trial-ending', window, NOW, 10)).toEqual([]);
    expect(await notices.due('trial-ended', window, NOW, 10)).toHaveLength(1);
    await notices.release('u-soon', 'trial-ending');
    expect(await notices.due('trial-ending', window, NOW, 10)).toHaveLength(1);
  });
});
