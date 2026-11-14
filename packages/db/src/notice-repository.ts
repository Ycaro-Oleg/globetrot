import { and, eq, gt, lte, sql } from 'drizzle-orm';
import type { Database } from './client';
import { accountNotice, subscription, user, userPreference } from './schema';

/** The worker's queries for one-time account emails (packages/application/src/billing/trial-reminders.ts). */

type Executor = Pick<Database, 'select' | 'insert' | 'delete'>;
export type NoticeKind = 'trial-ending' | 'trial-ended';

export function createNoticeRepository(executor: Executor) {
  return {
    /**
     * Verified accounts that signed up in `(after, upTo]`, with no plan paid past `now` and no `kind` email yet.
     * Only what the email needs: the address, the first name, the language and the sign-up time.
     */
    async due(kind: NoticeKind, range: { after: Date; upTo: Date }, now: Date, limit: number) {
      return executor
        .select({
          userId: user.id,
          email: user.email,
          name: user.name,
          locale: sql<string>`coalesce(${userPreference.locale}, 'en')`,
          signedUpAt: user.createdAt,
        })
        .from(user)
        .leftJoin(userPreference, eq(userPreference.userId, user.id))
        .where(
          and(
            eq(user.emailVerified, true),
            gt(user.createdAt, range.after),
            lte(user.createdAt, range.upTo),
            sql`not exists (select 1 from ${subscription} where ${subscription.userId} = ${user.id} and ${subscription.currentPeriodEnd} > ${now})`,
            sql`not exists (select 1 from ${accountNotice} where ${accountNotice.userId} = ${user.id} and ${accountNotice.kind} = ${kind})`,
          ),
        )
        .limit(limit);
    },
    /** Marks the email as sent before sending; false when another round already did. */
    async claim(userId: string, kind: NoticeKind, at: Date): Promise<boolean> {
      const rows = await executor
        .insert(accountNotice)
        .values({ userId, kind, sentAt: at })
        .onConflictDoNothing()
        .returning({ userId: accountNotice.userId });
      return rows.length > 0;
    },
    /** Gives the claim back when sending failed, so a later round tries again. */
    async release(userId: string, kind: NoticeKind): Promise<void> {
      await executor
        .delete(accountNotice)
        .where(and(eq(accountNotice.userId, userId), eq(accountNotice.kind, kind)));
    },
  };
}

export type NoticeRepository = ReturnType<typeof createNoticeRepository>;
