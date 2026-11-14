import { eq } from 'drizzle-orm';
import type { Database } from './client';
import { tripShare } from './schema';

/** PostgreSQL adapter for a trip's public link (packages/application/src/ports.ts). */

type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

export function createShareRepository(executor: Executor) {
  return {
    async findByTrip(tripId: string) {
      const [row] = await executor.select().from(tripShare).where(eq(tripShare.tripId, tripId));
      return row ?? null;
    },
    async findBySlug(slug: string) {
      const [row] = await executor.select().from(tripShare).where(eq(tripShare.slug, slug));
      return row ?? null;
    },
    async insert(record: {
      readonly slug: string;
      readonly tripId: string;
      readonly ownerId: string;
      readonly showAmounts: boolean;
      readonly createdAt: Date;
    }) {
      await executor.insert(tripShare).values(record);
    },
    async setShowAmounts(tripId: string, showAmounts: boolean) {
      await executor.update(tripShare).set({ showAmounts }).where(eq(tripShare.tripId, tripId));
    },
    async deleteByTrip(tripId: string) {
      await executor.delete(tripShare).where(eq(tripShare.tripId, tripId));
    },
  };
}

export type ShareRepository = ReturnType<typeof createShareRepository>;
