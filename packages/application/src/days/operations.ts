import { tripDays } from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { NotFoundError, ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type {
  AuditMetadata,
  DayPlaceRecord,
  DestinationRecord,
  Ports,
  Transaction,
} from '../ports';
import { loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import {
  addDayPlaceFields,
  DAY_PLACES_MAX,
  dayPlanSchema,
  moveDayPlaceFields,
  type DayPlanView,
} from './schemas';

/** How many days the route has now: one per night, by the domain rule. */
function dayCount(destinations: readonly DestinationRecord[]): number {
  return tripDays({
    startDate: null,
    stops: destinations.map((d) => ({ id: d.id, nights: d.nights, state: 'planned', places: [] })),
  }).length;
}

/** The plan as people read it: a stop that is gone reads as none, a day past the route as "No day". */
function planOf(
  places: readonly DayPlaceRecord[],
  destinations: readonly DestinationRecord[],
): DayPlanView {
  const stops = new Set(destinations.map((d) => d.id));
  const days = dayCount(destinations);
  return {
    places: places.map((place) => ({
      id: place.id,
      destinationId:
        place.destinationId !== null && stops.has(place.destinationId) ? place.destinationId : null,
      name: place.name,
      minutes: place.minutes,
      day: place.day !== null && place.day <= days ? place.day : null,
    })),
  };
}

type ReadPorts = Pick<Ports, 'trips' | 'dayPlaces' | 'destinations'>;

export function createListDayPlaces(deps: ReadPorts) {
  return defineOperation({
    name: 'listDayPlaces',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: dayPlanSchema,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const [places, destinations] = await Promise.all([
        deps.dayPlaces.listByTrip(trip.id),
        deps.destinations.listByTrip(trip.id),
      ]);
      return planOf(places, destinations);
    },
  });
}

type WritePorts = Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>;

function invalid(field: string, code: string, message: string): never {
  throw new ValidationError([{ field, code, message }]);
}

export function createAddDayPlace(deps: WritePorts) {
  return defineOperation({
    name: 'addDayPlace',
    kind: 'command',
    input: addDayPlaceFields.extend({ tripId: tripIdSchema }),
    output: dayPlanSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'edit');
        const [places, destinations] = await Promise.all([
          tx.dayPlaces.listByTrip(trip.id),
          tx.destinations.listByTrip(trip.id),
        ]);
        if (places.length >= DAY_PLACES_MAX) {
          invalid('name', 'day_plan_full', `A trip keeps at most ${DAY_PLACES_MAX} places`);
        }
        const destinationId = input.destinationId ?? null;
        if (destinationId !== null && !destinations.some((d) => d.id === destinationId)) {
          invalid('destinationId', 'unknown_stop', 'That stop is not on this trip');
        }
        await tx.dayPlaces.insert({
          id: deps.ids.newId(),
          tripId: trip.id,
          destinationId,
          name: input.name,
          minutes: input.minutes,
          day: null,
          position: places.reduce((max, place) => Math.max(max, place.position + 1), 0),
          createdAt: now,
        });
        await record(tx, deps, actor, now, 'day_place.add', trip.id, {});
        return planOf(await tx.dayPlaces.listByTrip(trip.id), destinations);
      });
    },
  });
}

/** A place of another trip, or a missing one, is the same "not found". */
async function loadOwnedPlace(
  tx: Pick<Ports, 'dayPlaces'>,
  tripId: string,
  placeId: string,
): Promise<DayPlaceRecord> {
  const place = await tx.dayPlaces.findById(placeId);
  if (!place || place.tripId !== tripId) throw new NotFoundError();
  return place;
}

/**
 * Moves a place to a day (or to "No day"), before another place of that day or at its end. Positions are
 * renumbered across the trip, so the order is always total and gap-free.
 */
export function createMoveDayPlace(deps: WritePorts) {
  return defineOperation({
    name: 'moveDayPlace',
    kind: 'command',
    input: moveDayPlaceFields.extend({ tripId: tripIdSchema, placeId: z.uuid() }),
    output: dayPlanSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'edit');
        const moving = await loadOwnedPlace(tx, trip.id, input.placeId);
        const [places, destinations] = await Promise.all([
          tx.dayPlaces.listByTrip(trip.id),
          tx.destinations.listByTrip(trip.id),
        ]);
        if (input.day !== null && input.day > dayCount(destinations)) {
          invalid('day', 'day_out_of_range', 'The route has no such day');
        }
        // What people see: a day past the route is "No day", so compare with that.
        const shownDay = (place: DayPlaceRecord) =>
          place.day !== null && place.day <= dayCount(destinations) ? place.day : null;
        const others = places.filter((place) => place.id !== moving.id);
        let at = -1;
        if (input.beforeId !== undefined) {
          at = others.findIndex((place) => place.id === input.beforeId);
          const before = others[at];
          if (!before || shownDay(before) !== input.day) {
            invalid('beforeId', 'not_on_that_day', 'That place is not on that day');
          }
        }
        if (at < 0) {
          at = others.length;
          for (let index = others.length - 1; index >= 0; index--) {
            if (shownDay(others[index]!) === input.day) {
              at = index + 1;
              break;
            }
          }
        }
        const ordered = [
          ...others.slice(0, at),
          { ...moving, day: input.day },
          ...others.slice(at),
        ];
        await tx.dayPlaces.placeMany(
          ordered
            .map((place, position) => ({ id: place.id, day: place.day, position }))
            .filter((entry) => {
              const before = places.find((place) => place.id === entry.id);
              return !before || before.position !== entry.position || before.day !== entry.day;
            }),
          now,
        );
        await record(tx, deps, actor, now, 'day_place.move', trip.id, { day: input.day ?? 'none' });
        return planOf(await tx.dayPlaces.listByTrip(trip.id), destinations);
      });
    },
  });
}

export function createRemoveDayPlace(deps: WritePorts) {
  return defineOperation({
    name: 'removeDayPlace',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, placeId: z.uuid() }),
    output: dayPlanSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'edit');
        await loadOwnedPlace(tx, trip.id, input.placeId);
        await tx.dayPlaces.delete(input.placeId);
        await record(tx, deps, actor, now, 'day_place.remove', trip.id, {});
        const destinations = await tx.destinations.listByTrip(trip.id);
        return planOf(await tx.dayPlaces.listByTrip(trip.id), destinations);
      });
    },
  });
}

/** Audit: names are personal, so only the action and the day are kept. */
async function record(
  tx: Pick<Transaction, 'audit'>,
  deps: Pick<Ports, 'ids'>,
  actor: Actor,
  now: Date,
  action: string,
  tripId: string,
  metadata: AuditMetadata,
) {
  await tx.audit.record({
    id: deps.ids.newId(),
    occurredAt: now,
    actor,
    action,
    entityType: 'trip',
    entityId: tripId,
    metadata,
  });
}
