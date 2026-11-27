import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from './client';
import { tripInvite, tripMember, user } from './schema';

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
