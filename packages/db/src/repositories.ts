import type { TripStatus, TripVisibility } from '@globetrot/domain';
import { and, desc, eq, ne, type SQL } from 'drizzle-orm';
import type { Database } from './client';
import { auditEvent, idempotencyKey, trip } from './schema';

/**
 * PostgreSQL adapters for the application ports (packages/application/src/ports.ts). The shapes below match
 * those ports structurally, so this package does not import the application layer (ADR-0006: dependencies
 * point inwards, adapters are wired in apps/api).
 */

/** A pooled client or a transaction: both run the same queries. */
type Executor = Pick<Database, 'select' | 'insert' | 'update'>;

/** Most trips returned by one list call. Pagination arrives when a user can plausibly reach it. */
export const MAX_LISTED_TRIPS = 200;

export interface TripRow {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly currency: string;
  readonly status: TripStatus;
  readonly visibility: TripVisibility;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const asTripRow = (row: typeof trip.$inferSelect): TripRow => ({
  ...row,
  status: row.status as TripStatus,
  visibility: row.visibility as TripVisibility,
});

export function createTripRepository(executor: Executor) {
  return {
    async findById(id: string): Promise<TripRow | null> {
      const [row] = await executor.select().from(trip).where(eq(trip.id, id)).limit(1);
      return row ? asTripRow(row) : null;
    },

    async listByOwner(
      ownerId: string,
      options: { readonly includeArchived: boolean },
    ): Promise<TripRow[]> {
      const filters: SQL[] = [eq(trip.ownerId, ownerId)];
      if (!options.includeArchived) filters.push(ne(trip.status, 'archived'));
      const rows = await executor
        .select()
        .from(trip)
        .where(and(...filters))
        .orderBy(desc(trip.createdAt), desc(trip.id))
        .limit(MAX_LISTED_TRIPS);
      return rows.map(asTripRow);
    },

    async insert(input: Omit<TripRow, 'updatedAt'>): Promise<TripRow> {
      const [row] = await executor
        .insert(trip)
        .values({ ...input, updatedAt: input.createdAt })
        .returning();
      if (!row) throw new Error('trip insert returned no row');
      return asTripRow(row);
    },

    async update(
      id: string,
      patch: {
        readonly title?: string | undefined;
        readonly startDate?: string | null | undefined;
        readonly currency?: string | undefined;
        readonly status?: TripStatus | undefined;
      },
      updatedAt: Date,
    ): Promise<TripRow> {
      const [row] = await executor
        .update(trip)
        .set({
          updatedAt,
          // `undefined` leaves a column alone; `null` clears the start date.
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.startDate === undefined ? {} : { startDate: patch.startDate }),
          ...(patch.currency === undefined ? {} : { currency: patch.currency }),
          ...(patch.status === undefined ? {} : { status: patch.status }),
        })
        .where(eq(trip.id, id))
        .returning();
      if (!row) throw new Error('trip to update does not exist');
      return asTripRow(row);
    },
  };
}

export function createAuditLog(executor: Executor) {
  return {
    async record(event: {
      readonly id: string;
      readonly occurredAt: Date;
      readonly actor: { readonly kind: string; readonly userId: string };
      readonly action: string;
      readonly entityType: string;
      readonly entityId: string;
      readonly metadata: Readonly<Record<string, unknown>>;
    }): Promise<void> {
      await executor.insert(auditEvent).values({
        id: event.id,
        occurredAt: event.occurredAt,
        actorKind: event.actor.kind,
        actorId: event.actor.userId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata,
      });
    },
  };
}

type IdempotencyStart =
  | { readonly state: 'new' }
  | { readonly state: 'replay'; readonly response: unknown }
  | { readonly state: 'mismatch' };

export function createIdempotencyStore(executor: Executor) {
  return {
    /**
     * Inserts the key, or finds what an earlier use of it did. Two requests racing with the same key both
     * reach the INSERT; the second one waits on the first one's row until it commits, then inserts nothing
     * and reads the stored result. Only one of them ever does the work.
     */
    async begin(input: {
      readonly ownerId: string;
      readonly key: string;
      readonly fingerprint: string;
      readonly createdAt: Date;
    }): Promise<IdempotencyStart> {
      const inserted = await executor
        .insert(idempotencyKey)
        .values(input)
        .onConflictDoNothing()
        .returning({ key: idempotencyKey.key });
      if (inserted.length > 0) return { state: 'new' };

      const [existing] = await executor
        .select()
        .from(idempotencyKey)
        .where(and(eq(idempotencyKey.ownerId, input.ownerId), eq(idempotencyKey.key, input.key)))
        .limit(1);
      if (!existing) throw new Error('idempotency key vanished while it was being read');
      if (existing.fingerprint !== input.fingerprint) return { state: 'mismatch' };
      // The key and its response are written in one transaction, so a visible key always has a response.
      if (existing.response === null) throw new Error('idempotency key has no stored response');
      return { state: 'replay', response: existing.response };
    },

    async complete(ownerId: string, key: string, response: unknown): Promise<void> {
      await executor
        .update(idempotencyKey)
        .set({ response })
        .where(and(eq(idempotencyKey.ownerId, ownerId), eq(idempotencyKey.key, key)));
    },
  };
}

export type TripRepository = ReturnType<typeof createTripRepository>;
export type AuditLog = ReturnType<typeof createAuditLog>;
export type IdempotencyStore = ReturnType<typeof createIdempotencyStore>;

export interface Transaction {
  readonly trips: TripRepository;
  readonly audit: AuditLog;
  readonly idempotency: IdempotencyStore;
}

/** Everything inside `run` commits together, or rolls back if the callback throws. */
export function createUnitOfWork(db: Database) {
  return {
    run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
      return db.transaction((tx) =>
        work({
          trips: createTripRepository(tx),
          audit: createAuditLog(tx),
          idempotency: createIdempotencyStore(tx),
        }),
      );
    },
  };
}
