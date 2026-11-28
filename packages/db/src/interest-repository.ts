import { eq, sql } from 'drizzle-orm';
import type { Database } from './client';
import { createAuditLog } from './repositories';
import { interestEmailDay, interestListEntry, interestListSuppression } from './schema';

/**
 * Storage of the interest list (ADR-0037) for `createInterestList` in @globetrot/application. Every call runs in
 * one transaction; reading an entry locks it, so two requests for the same address take turns. Audit events
 * have no person behind them: the actor is recorded as a visitor.
 */

type Entry = typeof interestListEntry.$inferSelect;
type Locale = 'en' | 'pt-BR';
type Source = 'landing' | 'itinerary';

const toRow = (entry: Entry) => ({
  ...entry,
  locale: entry.locale as Locale,
  source: entry.source as Source,
});

const VISITOR = { kind: 'visitor', userId: 'anonymous' } as const;

export function createInterestListStore(db: Database) {
  return {
    transaction<T>(work: (tx: ReturnType<typeof transactionApi>) => Promise<T>): Promise<T> {
      return db.transaction((tx) => work(transactionApi(tx as unknown as Database)));
    },
  };
}

function transactionApi(tx: Database) {
  const audit = createAuditLog(tx);
  return {
    async isSuppressed(emailHash: string): Promise<boolean> {
      const rows = await tx
        .select({ hash: interestListSuppression.emailHash })
        .from(interestListSuppression)
        .where(eq(interestListSuppression.emailHash, emailHash))
        .limit(1);
      return rows.length > 0;
    },
    async findByEmail(email: string) {
      const [row] = await tx
        .select()
        .from(interestListEntry)
        .where(eq(interestListEntry.email, email))
        .for('update');
      return row ? toRow(row) : null;
    },
    async findById(id: string) {
      const [row] = await tx
        .select()
        .from(interestListEntry)
        .where(eq(interestListEntry.id, id))
        .for('update');
      return row ? toRow(row) : null;
    },
    async insert(row: typeof interestListEntry.$inferInsert): Promise<boolean> {
      const inserted = await tx
        .insert(interestListEntry)
        .values(row)
        .onConflictDoNothing({ target: interestListEntry.email })
        .returning({ id: interestListEntry.id });
      return inserted.length > 0;
    },
    async update(id: string, patch: Partial<typeof interestListEntry.$inferInsert>): Promise<void> {
      if (Object.keys(patch).length === 0) return;
      await tx.update(interestListEntry).set(patch).where(eq(interestListEntry.id, id));
    },
    async remove(id: string): Promise<void> {
      await tx.delete(interestListEntry).where(eq(interestListEntry.id, id));
    },
    async suppress(emailHash: string, at: Date): Promise<void> {
      await tx
        .insert(interestListSuppression)
        .values({ emailHash, unsubscribedAt: at })
        .onConflictDoNothing();
    },
    async countEmail(day: string): Promise<number> {
      const [row] = await tx
        .insert(interestEmailDay)
        .values({ day, sent: 1 })
        .onConflictDoUpdate({
          target: interestEmailDay.day,
          set: { sent: sql`${interestEmailDay.sent} + 1` },
        })
        .returning({ sent: interestEmailDay.sent });
      return row?.sent ?? 1;
    },
    async audit(event: {
      readonly id: string;
      readonly occurredAt: Date;
      readonly action: string;
      readonly entityId: string;
      readonly metadata: Readonly<Record<string, string | number | boolean>>;
    }): Promise<void> {
      await audit.record({ ...event, actor: VISITOR, entityType: 'interest_list_entry' });
    },
  };
}

export type InterestListStoreRepository = ReturnType<typeof createInterestListStore>;
