import { and, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from './client';
import { destination, idempotencyKey, interestListEntry, mediaAsset, post } from './schema';

/** Housekeeping queries for the worker (packages/application/src/maintenance). No user acts here. */

type Executor = Pick<Database, 'select' | 'delete'>;

export function createMaintenanceRepository(executor: Executor) {
  const placed = (column: typeof post.photos | typeof destination.photos) =>
    sql`${column} @> jsonb_build_array(jsonb_build_object('mediaId', ${mediaAsset.id}::text))`;
  return {
    /** Uploads older than `before` that no post (even a deleted, restorable one) and no stop shows. */
    async unplacedMedia(before: Date, limit: number): Promise<string[]> {
      const rows = await executor
        .select({ id: mediaAsset.id })
        .from(mediaAsset)
        .where(
          and(
            lt(mediaAsset.createdAt, before),
            sql`not exists (select 1 from ${post} where ${placed(post.photos)})`,
            sql`not exists (select 1 from ${destination} where ${placed(destination.photos)})`,
          ),
        )
        .limit(limit);
      return rows.map((row) => row.id);
    },
    async deleteMedia(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      await executor.delete(mediaAsset).where(inArray(mediaAsset.id, [...ids]));
    },
    /** Which of these ids still have a row. */
    async existingMedia(ids: readonly string[]): Promise<Set<string>> {
      if (ids.length === 0) return new Set();
      const rows = await executor
        .select({ id: mediaAsset.id })
        .from(mediaAsset)
        .where(inArray(mediaAsset.id, [...ids]));
      return new Set(rows.map((row) => row.id));
    },
    /** Idempotency records older than `before`: they only matter for a retry window. Answers how many went. */
    async deleteIdempotencyKeysBefore(before: Date): Promise<number> {
      const rows = await executor
        .delete(idempotencyKey)
        .where(lt(idempotencyKey.createdAt, before))
        .returning({ key: idempotencyKey.key });
      return rows.length;
    },
    /** Interest-list entries never confirmed and made before `before` (ADR-0037). Answers how many went. */
    async deleteUnconfirmedInterestBefore(before: Date): Promise<number> {
      const rows = await executor
        .delete(interestListEntry)
        .where(and(isNull(interestListEntry.confirmedAt), lt(interestListEntry.createdAt, before)))
        .returning({ id: interestListEntry.id });
      return rows.length;
    },
  };
}

export type MaintenanceRepository = ReturnType<typeof createMaintenanceRepository>;
