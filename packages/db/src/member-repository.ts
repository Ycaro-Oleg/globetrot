import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from './client';
import { tripInvite, tripMember, tripPersonMoney, user } from './schema';

/** PostgreSQL adapter for trip members and invite links (packages/application/src/ports.ts, ADR-0024). */

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;
type Role = 'editor' | 'viewer';

export function createMemberRepository(executor: Executor) {
  return {
    async listByTrip(tripId: string) {
      const rows = await executor
        .select({
          tripId: tripMember.tripId,
          userId: tripMember.userId,
          name: user.name,
          role: tripMember.role,
          joinedAt: tripMember.joinedAt,
        })
        .from(tripMember)
        .innerJoin(user, eq(user.id, tripMember.userId))
        .where(eq(tripMember.tripId, tripId))
        .orderBy(asc(tripMember.joinedAt));
      return rows.map((row) => ({ ...row, role: row.role as Role }));
    },
    async listMoney(tripId: string) {
      return executor
        .select({
          tripId: tripPersonMoney.tripId,
          userId: tripPersonMoney.userId,
          shareBp: tripPersonMoney.shareBp,
          savedMinor: tripPersonMoney.savedMinor,
          monthlyMinor: tripPersonMoney.monthlyMinor,
        })
        .from(tripPersonMoney)
        .where(eq(tripPersonMoney.tripId, tripId));
    },
    async upsertMoney(
      tripId: string,
      userId: string,
      patch: { readonly savedMinor?: bigint; readonly monthlyMinor?: bigint },
      now: Date,
    ) {
      await executor
        .insert(tripPersonMoney)
        .values({ tripId, userId, ...patch, updatedAt: now })
        .onConflictDoUpdate({
          target: [tripPersonMoney.tripId, tripPersonMoney.userId],
          set: { ...patch, updatedAt: now },
        });
    },
    async setShares(
      tripId: string,
      shares: readonly { readonly userId: string; readonly shareBp: number | null }[],
      now: Date,
    ) {
      for (const { userId, shareBp } of shares) {
        await executor
          .insert(tripPersonMoney)
          .values({ tripId, userId, shareBp, updatedAt: now })
          .onConflictDoUpdate({
            target: [tripPersonMoney.tripId, tripPersonMoney.userId],
            set: { shareBp, updatedAt: now },
          });
      }
    },
    async findInviteByHash(tokenHash: string) {
      const [row] = await executor
        .select()
        .from(tripInvite)
        .where(eq(tripInvite.tokenHash, tokenHash))
        .limit(1);
      return row ? { ...row, role: row.role as Role } : null;
    },
    async listOpenInvites(tripId: string, now: Date) {
      const rows = await executor
        .select()
        .from(tripInvite)
        .where(
          and(
            eq(tripInvite.tripId, tripId),
            isNull(tripInvite.revokedAt),
            gt(tripInvite.expiresAt, now),
          ),
        )
        .orderBy(desc(tripInvite.createdAt));
      return rows.map((row) => ({ ...row, role: row.role as Role }));
    },
    async add(row: {
      readonly tripId: string;
      readonly userId: string;
      readonly role: Role;
      readonly joinedAt: Date;
    }) {
      const inserted = await executor
        .insert(tripMember)
        .values(row)
        .onConflictDoNothing()
        .returning({ userId: tripMember.userId });
      return inserted.length > 0;
    },
    async remove(tripId: string, userId: string) {
      const removed = await executor
        .delete(tripMember)
        .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
        .returning({ userId: tripMember.userId });
      return removed.length > 0;
    },
    async insertInvite(row: {
      readonly id: string;
      readonly tripId: string;
      readonly tokenHash: string;
      readonly role: Role;
      readonly createdBy: string;
      readonly createdAt: Date;
      readonly expiresAt: Date;
    }) {
      await executor.insert(tripInvite).values(row);
    },
    async revokeInvite(id: string, at: Date) {
      await executor.update(tripInvite).set({ revokedAt: at }).where(eq(tripInvite.id, id));
    },
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
