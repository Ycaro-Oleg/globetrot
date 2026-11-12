import {
  DEFAULT_CURRENCY,
  DEFAULT_TRIP_STATUS,
  DEFAULT_TRIP_VISIBILITY,
  type TripStatus,
} from '@globetrot/domain';
import { z } from 'zod';
import { assertOwner } from '../authorization';
import { canonicalJson } from '../canonical-json';
import { IdempotencyKeyReusedError, NotFoundError, ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { Actor } from '../actor';
import type { AuditMetadata, Ports, TripPatch, TripRecord } from '../ports';
import {
  createTripFields,
  hasAChange,
  toTripView,
  tripIdSchema,
  tripSchema,
  updateTripFields,
} from './schemas';

type TripDeps = Pick<Ports, 'trips' | 'unitOfWork' | 'clock' | 'ids'>;

/** 8 to 128 characters of letters, digits and `. _ : -`. A UUID works. Too short keys collide by accident. */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{8,128}$/)
  .meta({
    description: 'Client-chosen key that makes a retry safe.',
    example: 'b5f1c0de-6a3e-4c1a-9d52-3a1e8a0b7f10',
  });

/** Loads a trip for an actor. Missing and someone else's are the same `NotFoundError`. */
export async function loadOwnedTrip(
  reader: { findById(id: string): Promise<TripRecord | null> },
  actor: Actor,
  id: string,
): Promise<TripRecord> {
  const trip = await reader.findById(id);
  // Same error, same message as `assertOwner`: nothing tells a missing trip from someone else's.
  if (!trip) throw new NotFoundError();
  assertOwner(actor, trip.ownerId);
  return trip;
}

// --- Queries -------------------------------------------------------------------------------------------

export function createListTrips(deps: Pick<Ports, 'trips'>) {
  return defineOperation({
    name: 'listTrips',
    kind: 'query',
    input: z.object({
      includeArchived: z.boolean().default(false).meta({ description: 'Include archived trips.' }),
    }),
    output: z.object({ trips: z.array(tripSchema) }),
    async handler(actor, input) {
      const trips = await deps.trips.listByOwner(actor.userId, {
        includeArchived: input.includeArchived,
      });
      // Defence in depth: the store already filters by owner.
      return { trips: trips.filter((trip) => trip.ownerId === actor.userId).map(toTripView) };
    },
  });
}

export function createGetTrip(deps: Pick<Ports, 'trips'>) {
  return defineOperation({
    name: 'getTrip',
    kind: 'query',
    input: z.object({ id: tripIdSchema }),
    output: tripSchema,
    async handler(actor, input) {
      return toTripView(await loadOwnedTrip(deps.trips, actor, input.id));
    },
  });
}

// --- Commands ------------------------------------------------------------------------------------------

export function createCreateTrip(deps: TripDeps) {
  return defineOperation({
    name: 'createTrip',
    kind: 'command',
    input: createTripFields.extend({ idempotencyKey: idempotencyKeySchema.optional() }),
    output: tripSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      const request = {
        title: input.title,
        startDate: input.startDate ?? null,
        currency: input.currency ?? DEFAULT_CURRENCY,
      };
      const key = input.idempotencyKey;

      return deps.unitOfWork.run(async (tx) => {
        if (key !== undefined) {
          const start = await tx.idempotency.begin({
            ownerId: actor.userId,
            key,
            fingerprint: `createTrip ${canonicalJson(request)}`,
            createdAt: now,
          });
          if (start.state === 'mismatch') throw new IdempotencyKeyReusedError();
          // A retry of a request that already succeeded: the same trip, nothing created, nothing audited.
          if (start.state === 'replay') return tripSchema.parse(start.response);
        }

        const trip = await tx.trips.insert({
          id: deps.ids.newId(),
          ownerId: actor.userId,
          ...request,
          status: DEFAULT_TRIP_STATUS,
          visibility: DEFAULT_TRIP_VISIBILITY,
          createdAt: now,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.create',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });

        const view = toTripView(trip);
        if (key !== undefined) await tx.idempotency.complete(actor.userId, key, view);
        return view;
      });
    },
  });
}

const updateInput = updateTripFields
  .extend({ id: tripIdSchema })
  .refine(hasAChange, { error: 'Provide at least one field to change' });

export function createUpdateTrip(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'updateTrip',
    kind: 'command',
    input: updateInput,
    output: tripSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      const patch: TripPatch = {
        title: input.title,
        startDate: input.startDate,
        currency: input.currency,
        status: input.status,
      };
      const fields = (Object.keys(patch) as (keyof TripPatch)[]).filter(
        (field) => patch[field] !== undefined,
      );

      return deps.unitOfWork.run(async (tx) => {
        const current = await loadOwnedTrip(tx.trips, actor, input.id);
        // Amounts are stored in the trip's currency: changing it under existing costs or savings would silently
        // change what they mean. It can be changed while the trip has no money in it.
        if (input.currency !== undefined && input.currency !== current.currency) {
          const savings = await tx.savings.find(input.id);
          if (
            (await tx.expenses.countByTrip(input.id)) > 0 ||
            (savings !== null && (savings.savedMinor > 0n || savings.monthlyMinor > 0n))
          ) {
            throw new ValidationError([
              {
                field: 'currency',
                code: 'currency_locked',
                message: 'The currency cannot change while the trip has costs or savings',
              },
            ]);
          }
        }
        const trip = await tx.trips.update(input.id, patch, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.update',
          entityType: 'trip',
          entityId: trip.id,
          // Names of the fields, never their values. The status is a fixed word, so it is safe to keep.
          metadata: statusAware({ fields }, input.status),
        });
        return toTripView(trip);
      });
    },
  });
}

export function createArchiveTrip(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'archiveTrip',
    kind: 'command',
    input: z.object({ id: tripIdSchema }),
    output: tripSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const current = await loadOwnedTrip(tx.trips, actor, input.id);
        // Archiving twice is a no-op: same answer, no write, no audit entry.
        if (current.status === 'archived') return toTripView(current);

        const trip = await tx.trips.update(input.id, { status: 'archived' }, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.archive',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return toTripView(trip);
      });
    },
  });
}

function statusAware(
  metadata: { fields: string[] },
  status: TripStatus | undefined,
): AuditMetadata {
  return status === undefined ? metadata : { ...metadata, status };
}
