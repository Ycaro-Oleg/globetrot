import type {
  MotionChoice,
  ThemeChoice,
  TripStatus,
  TripVisibility,
  UnitSystem,
} from '@globetrot/domain';
import { and, asc, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import type { Database } from './client';
import {
  auditEvent,
  checklistItem,
  destination,
  expense,
  idempotencyKey,
  rateLimit,
  trip,
  tripSavings,
  userPreference,
} from './schema';

/**
 * PostgreSQL adapters for the application ports (packages/application/src/ports.ts). The shapes below match
 * those ports structurally, so this package does not import the application layer (ADR-0006: dependencies
 * point inwards, adapters are wired in apps/api).
 */

/** A pooled client or a transaction: both run the same queries. */
type Executor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

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

export interface PreferencesRow {
  readonly locale: string;
  readonly currency: string;
  readonly homeCountry: string | null;
  readonly nationality: string | null;
  readonly timeZone: string | null;
  readonly units: UnitSystem;
  readonly theme: ThemeChoice;
  readonly motion: MotionChoice;
}

const asPreferencesRow = (row: typeof userPreference.$inferSelect): PreferencesRow => ({
  locale: row.locale,
  currency: row.currency,
  homeCountry: row.homeCountry,
  nationality: row.nationality,
  timeZone: row.timeZone,
  units: row.units as UnitSystem,
  theme: row.theme as ThemeChoice,
  motion: row.motion as MotionChoice,
});

export function createPreferencesRepository(executor: Executor) {
  return {
    async find(userId: string): Promise<PreferencesRow | null> {
      const [row] = await executor
        .select()
        .from(userPreference)
        .where(eq(userPreference.userId, userId))
        .limit(1);
      return row ? asPreferencesRow(row) : null;
    },

    /**
     * Writes only the fields in `patch`. The first call creates the row, and the columns the patch leaves
     * out take the table defaults; later calls update just the named columns. Nothing is derived from
     * anything else, so changing the language can never move the currency or the country.
     */
    async upsert(
      userId: string,
      patch: {
        readonly locale?: string | undefined;
        readonly currency?: string | undefined;
        readonly homeCountry?: string | null | undefined;
        readonly nationality?: string | null | undefined;
        readonly timeZone?: string | null | undefined;
        readonly units?: UnitSystem | undefined;
        readonly theme?: ThemeChoice | undefined;
        readonly motion?: MotionChoice | undefined;
      },
      now: Date,
    ): Promise<PreferencesRow> {
      const changes = {
        ...(patch.locale === undefined ? {} : { locale: patch.locale }),
        ...(patch.currency === undefined ? {} : { currency: patch.currency }),
        ...(patch.homeCountry === undefined ? {} : { homeCountry: patch.homeCountry }),
        ...(patch.nationality === undefined ? {} : { nationality: patch.nationality }),
        ...(patch.timeZone === undefined ? {} : { timeZone: patch.timeZone }),
        ...(patch.units === undefined ? {} : { units: patch.units }),
        ...(patch.theme === undefined ? {} : { theme: patch.theme }),
        ...(patch.motion === undefined ? {} : { motion: patch.motion }),
      };
      const [row] = await executor
        .insert(userPreference)
        .values({ userId, ...changes, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: userPreference.userId, set: { ...changes, updatedAt: now } })
        .returning();
      if (!row) throw new Error('preferences upsert returned no row');
      return asPreferencesRow(row);
    },

    /**
     * Creates the row for a new account with the language it signed up in, and the defaults for the rest.
     * Does nothing when a row already exists. Used by the sign-up hook, not by an application operation.
     */
    async createDefaults(userId: string, locale: string, now: Date): Promise<void> {
      await executor
        .insert(userPreference)
        .values({ userId, locale, createdAt: now, updatedAt: now })
        .onConflictDoNothing();
    },
  };
}

/**
 * A per-key cooldown on the `rate_limit` table (the table Better Auth's limiter already uses, in PostgreSQL, so
 * every API instance shares it). `acquire` is one atomic statement: it lets the first caller through and makes
 * the others wait until `windowSeconds` have passed since the last one that got through. The key should not
 * hold personal data: callers pass a hash.
 */
export function createCooldown(executor: Executor) {
  return {
    /** `0` when the caller may go ahead (and the cooldown starts), otherwise the whole seconds to wait. */
    async acquire(key: string, windowSeconds: number, nowMs: number): Promise<number> {
      const windowMs = windowSeconds * 1000;
      const taken = await executor
        .insert(rateLimit)
        .values({ id: key, key, count: 1, lastRequest: nowMs })
        .onConflictDoUpdate({
          target: rateLimit.key,
          set: { count: sql`${rateLimit.count} + 1`, lastRequest: nowMs },
          setWhere: sql`${rateLimit.lastRequest} <= ${nowMs - windowMs}`,
        })
        .returning({ key: rateLimit.key });
      if (taken.length > 0) return 0;

      const [row] = await executor
        .select({ lastRequest: rateLimit.lastRequest })
        .from(rateLimit)
        .where(eq(rateLimit.key, key))
        .limit(1);
      const remainingMs = (row?.lastRequest ?? nowMs) + windowMs - nowMs;
      return Math.max(1, Math.ceil(remainingMs / 1000));
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

export interface DestinationRow {
  readonly id: string;
  readonly tripId: string;
  readonly position: number;
  readonly placeKey: string;
  readonly name: string;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly nights: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewDestinationRow {
  readonly id: string;
  readonly placeKey: string;
  readonly name: string;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly nights: number;
}

/** A trip's route, in order. Replaced as a whole inside one transaction. */
export function createDestinationRepository(executor: Executor) {
  const list = async (tripId: string): Promise<DestinationRow[]> =>
    executor
      .select()
      .from(destination)
      .where(eq(destination.tripId, tripId))
      .orderBy(destination.position);
  return {
    listByTrip: list,

    /** Deletes the trip's stops and writes `items` in order (position = index). Returns what is stored. */
    async replaceForTrip(
      tripId: string,
      items: readonly NewDestinationRow[],
      now: Date,
    ): Promise<DestinationRow[]> {
      await executor.delete(destination).where(eq(destination.tripId, tripId));
      if (items.length === 0) return [];
      const rows = await executor
        .insert(destination)
        .values(
          items.map((item, position) => ({
            ...item,
            tripId,
            position,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .returning();
      return rows.sort((a, b) => a.position - b.position);
    },
  };
}

export interface ExpenseRow {
  readonly id: string;
  readonly tripId: string;
  readonly category: string;
  readonly status: string;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly tripAmountMinor: bigint;
  readonly fxRate: string | null;
  readonly fxSource: string | null;
  readonly fxAsOf: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewExpenseRow = Omit<ExpenseRow, 'updatedAt'>;

export type ExpensePatchRow = Partial<
  Omit<ExpenseRow, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
>;

export function createExpenseRepository(executor: Executor) {
  return {
    async listByTrip(tripId: string): Promise<ExpenseRow[]> {
      return executor
        .select()
        .from(expense)
        .where(eq(expense.tripId, tripId))
        .orderBy(desc(expense.createdAt), desc(expense.id));
    },
    async findById(id: string): Promise<ExpenseRow | null> {
      const [row] = await executor.select().from(expense).where(eq(expense.id, id)).limit(1);
      return row ?? null;
    },
    async insert(input: NewExpenseRow): Promise<ExpenseRow> {
      const [row] = await executor
        .insert(expense)
        .values({ ...input, updatedAt: input.createdAt })
        .returning();
      if (!row) throw new Error('expense insert returned no row');
      return row;
    },
    async update(id: string, patch: ExpensePatchRow, updatedAt: Date): Promise<ExpenseRow> {
      const [row] = await executor
        .update(expense)
        .set({ ...patch, updatedAt })
        .where(eq(expense.id, id))
        .returning();
      if (!row) throw new Error('expense to update does not exist');
      return row;
    },
    async delete(id: string): Promise<void> {
      await executor.delete(expense).where(eq(expense.id, id));
    },
    async countByTrip(tripId: string): Promise<number> {
      const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(expense)
        .where(eq(expense.tripId, tripId));
      return row?.count ?? 0;
    },
  };
}

export interface ChecklistItemRow {
  readonly id: string;
  readonly tripId: string;
  readonly group: string;
  readonly label: string;
  readonly done: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewChecklistItemRow = Omit<ChecklistItemRow, 'updatedAt'>;
export type ChecklistItemPatchRow = Partial<Pick<ChecklistItemRow, 'label' | 'done'>>;

export function createChecklistRepository(executor: Executor) {
  return {
    /** In the order they were added. */
    async listByTrip(tripId: string): Promise<ChecklistItemRow[]> {
      return executor
        .select()
        .from(checklistItem)
        .where(eq(checklistItem.tripId, tripId))
        .orderBy(asc(checklistItem.createdAt), asc(checklistItem.id));
    },
    async findById(id: string): Promise<ChecklistItemRow | null> {
      const [row] = await executor
        .select()
        .from(checklistItem)
        .where(eq(checklistItem.id, id))
        .limit(1);
      return row ?? null;
    },
    async insertMany(items: readonly NewChecklistItemRow[]): Promise<ChecklistItemRow[]> {
      if (items.length === 0) return [];
      return executor
        .insert(checklistItem)
        .values(items.map((item) => ({ ...item, updatedAt: item.createdAt })))
        .returning();
    },
    async update(
      id: string,
      patch: ChecklistItemPatchRow,
      updatedAt: Date,
    ): Promise<ChecklistItemRow> {
      const [row] = await executor
        .update(checklistItem)
        .set({ ...patch, updatedAt })
        .where(eq(checklistItem.id, id))
        .returning();
      if (!row) throw new Error('checklist item to update does not exist');
      return row;
    },
    async delete(id: string): Promise<void> {
      await executor.delete(checklistItem).where(eq(checklistItem.id, id));
    },
    async countByTrip(tripId: string): Promise<number> {
      const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(checklistItem)
        .where(eq(checklistItem.tripId, tripId));
      return row?.count ?? 0;
    },
  };
}
export type ChecklistRepository = ReturnType<typeof createChecklistRepository>;

export interface SavingsRow {
  readonly tripId: string;
  readonly savedMinor: bigint;
  readonly monthlyMinor: bigint;
}

export function createSavingsRepository(executor: Executor) {
  return {
    async find(tripId: string): Promise<SavingsRow | null> {
      const [row] = await executor
        .select()
        .from(tripSavings)
        .where(eq(tripSavings.tripId, tripId))
        .limit(1);
      return row ?? null;
    },
    /** Creates the row (zero for what the patch leaves out) or changes only the fields in the patch. */
    async upsert(
      tripId: string,
      patch: {
        readonly savedMinor?: bigint | undefined;
        readonly monthlyMinor?: bigint | undefined;
      },
      now: Date,
    ): Promise<SavingsRow> {
      const changes = {
        ...(patch.savedMinor === undefined ? {} : { savedMinor: patch.savedMinor }),
        ...(patch.monthlyMinor === undefined ? {} : { monthlyMinor: patch.monthlyMinor }),
      };
      const [row] = await executor
        .insert(tripSavings)
        .values({ tripId, ...changes, updatedAt: now })
        .onConflictDoUpdate({ target: tripSavings.tripId, set: { ...changes, updatedAt: now } })
        .returning();
      if (!row) throw new Error('savings upsert returned no row');
      return row;
    },
  };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
export type SavingsRepository = ReturnType<typeof createSavingsRepository>;
export type DestinationRepository = ReturnType<typeof createDestinationRepository>;
export type TripRepository = ReturnType<typeof createTripRepository>;
export type PreferencesRepository = ReturnType<typeof createPreferencesRepository>;
export type Cooldown = ReturnType<typeof createCooldown>;
export type AuditLog = ReturnType<typeof createAuditLog>;
export type IdempotencyStore = ReturnType<typeof createIdempotencyStore>;

export interface Transaction {
  readonly trips: TripRepository;
  readonly destinations: DestinationRepository;
  readonly expenses: ExpenseRepository;
  readonly checklist: ChecklistRepository;
  readonly savings: SavingsRepository;
  readonly preferences: PreferencesRepository;
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
          destinations: createDestinationRepository(tx),
          expenses: createExpenseRepository(tx),
          checklist: createChecklistRepository(tx),
          savings: createSavingsRepository(tx),
          preferences: createPreferencesRepository(tx),
          audit: createAuditLog(tx),
          idempotency: createIdempotencyStore(tx),
        }),
      );
    },
  };
}
