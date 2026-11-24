import {
  milestones,
  recordStamps,
  toLocalDate,
  tripDays,
  type ChecklistGroup,
  type TripStop,
} from '@globetrot/domain';
import { z } from 'zod';
import { planOf } from '../budget/operations';
import { NotFoundError, ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { ChecklistItemRecord, Ports, Transaction } from '../ports';
import { loadOwnedTrip } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import {
  addChecklistItemsFields,
  CHECKLIST_MAX_ITEMS,
  checklistSchema,
  updateChecklistItemFields,
  type ChecklistView,
} from './schemas';

type ReadPorts = Pick<
  Ports,
  'trips' | 'checklist' | 'destinations' | 'expenses' | 'savings' | 'dayPlaces' | 'clock'
>;

/** The lists of a trip and the readiness stamps, derived by the same domain rules the tests cover. */
async function checklistOf(
  deps: Pick<ReadPorts, 'checklist' | 'destinations' | 'expenses' | 'savings' | 'dayPlaces'>,
  trip: Parameters<typeof planOf>[0],
  now: Date,
): Promise<ChecklistView> {
  const [items, destinations, expenses, savings, dayPlaces] = await Promise.all([
    deps.checklist.listByTrip(trip.id),
    deps.destinations.listByTrip(trip.id),
    deps.expenses.listByTrip(trip.id),
    deps.savings.find(trip.id),
    deps.dayPlaces.listByTrip(trip.id),
  ]);
  // Each scheduled place sits on the stop of its day, so "every day has a plan" reads the day plan.
  const route = destinations.map((d) => ({
    id: d.id,
    nights: d.nights,
    state: 'planned' as const,
  }));
  const days = tripDays({ startDate: null, stops: route.map((stop) => ({ ...stop, places: [] })) });
  const stops: TripStop[] = route.map((stop) => ({
    ...stop,
    places: dayPlaces
      .filter((place) => place.day !== null && days[place.day - 1]?.stopId === stop.id)
      .map((place) => ({ id: place.id, day: place.day, done: false })),
  }));
  const plan = planOf(trip, expenses, savings, {
    stops,
    checklist: items.map((item) => ({
      id: item.id,
      group: item.group as ChecklistGroup,
      done: item.done,
    })),
  });
  return {
    items: items.map((item) => ({
      id: item.id,
      group: item.group as ChecklistGroup,
      label: item.label,
      done: item.done,
    })),
    readiness: milestones(plan, toLocalDate(now.toISOString().slice(0, 10))),
    firstTime: [],
  };
}

/**
 * The lists after a change, and the stamps it earned for the very first time: those are recorded now with today's
 * date, so a stamp that comes off and back is never celebrated twice.
 */
async function checklistAfterChange(
  tx: Pick<Transaction, 'checklist' | 'destinations' | 'expenses' | 'savings' | 'dayPlaces'>,
  trip: Parameters<typeof planOf>[0],
  now: Date,
): Promise<ChecklistView> {
  const view = await checklistOf(tx, trip, now);
  const today = toLocalDate(now.toISOString().slice(0, 10));
  const recorded = Object.fromEntries(
    (await tx.checklist.stamps(trip.id)).map((stamp) => [
      stamp.milestone,
      toLocalDate(stamp.earnedOn),
    ]),
  );
  const { newlyEarned } = recordStamps(view.readiness, recorded, today);
  await tx.checklist.addStamps(
    trip.id,
    newlyEarned.map((milestone) => ({ milestone, earnedOn: today })),
  );
  return { ...view, firstTime: newlyEarned };
}

export function createGetChecklist(deps: ReadPorts) {
  return defineOperation({
    name: 'getChecklist',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: checklistSchema,
    async handler(actor, input) {
      const trip = await loadOwnedTrip(deps.trips, actor, input.tripId);
      return checklistOf(deps, trip, deps.clock.now());
    },
  });
}

type WritePorts = Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>;

export function createAddChecklistItems(deps: WritePorts) {
  return defineOperation({
    name: 'addChecklistItems',
    kind: 'command',
    input: addChecklistItemsFields.extend({ tripId: tripIdSchema }),
    output: checklistSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        if ((await tx.checklist.countByTrip(trip.id)) + input.items.length > CHECKLIST_MAX_ITEMS) {
          throw new ValidationError([
            {
              field: 'items',
              code: 'checklist_full',
              message: `A trip keeps at most ${CHECKLIST_MAX_ITEMS} checklist items`,
            },
          ]);
        }
        await tx.checklist.insertMany(
          input.items.map((item, index) => ({
            id: deps.ids.newId(),
            tripId: trip.id,
            group: item.group,
            label: item.label,
            done: false,
            // Items added together keep their order: one millisecond apart.
            createdAt: new Date(now.getTime() + index),
          })),
        );
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'checklist.add',
          entityType: 'trip',
          entityId: trip.id,
          // Labels are personal; the groups and the count are not.
          metadata: {
            groups: [...new Set(input.items.map((item) => item.group))],
            count: input.items.length,
          },
        });
        return checklistAfterChange(tx, trip, now);
      });
    },
  });
}

/** An item of another trip, or one that is missing, is the same "not found". */
async function loadOwnedItem(
  tx: Pick<Ports, 'checklist'>,
  tripId: string,
  itemId: string,
): Promise<ChecklistItemRecord> {
  const record = await tx.checklist.findById(itemId);
  if (!record || record.tripId !== tripId) throw new NotFoundError();
  return record;
}

export function createUpdateChecklistItem(deps: WritePorts) {
  return defineOperation({
    name: 'updateChecklistItem',
    kind: 'command',
    input: updateChecklistItemFields.and(z.object({ tripId: tripIdSchema, itemId: z.uuid() })),
    output: checklistSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        await loadOwnedItem(tx, trip.id, input.itemId);
        await tx.checklist.update(
          input.itemId,
          {
            ...(input.done === undefined ? {} : { done: input.done }),
            ...(input.label === undefined ? {} : { label: input.label }),
          },
          now,
        );
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'checklist.update',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {
            fields: [
              input.done === undefined ? '' : 'done',
              input.label === undefined ? '' : 'label',
            ].filter(Boolean),
          },
        });
        return checklistAfterChange(tx, trip, now);
      });
    },
  });
}

export function createDeleteChecklistItem(deps: WritePorts) {
  return defineOperation({
    name: 'deleteChecklistItem',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, itemId: z.uuid() }),
    output: checklistSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        await loadOwnedItem(tx, trip.id, input.itemId);
        await tx.checklist.delete(input.itemId);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'checklist.delete',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return checklistAfterChange(tx, trip, now);
      });
    },
  });
}
