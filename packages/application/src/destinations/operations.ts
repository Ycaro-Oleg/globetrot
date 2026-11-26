import { ownedPhotos } from '../media/operations';
import { z } from 'zod';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadOwnedTrip } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import {
  destinationListSchema,
  replaceDestinationsBody,
  replaceDestinationsResult,
  toDestinationView,
  toVisaView,
  visaListSchema,
} from './schemas';

/** A trip's route, in order. Someone else's trip and a missing one are the same "not found". */
export function createListDestinations(deps: Pick<Ports, 'trips' | 'destinations'>) {
  return defineOperation({
    name: 'listDestinations',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: destinationListSchema,
    async handler(actor, input) {
      await loadOwnedTrip(deps.trips, actor, input.tripId);
      const records = await deps.destinations.listByTrip(input.tripId);
      return { destinations: records.map(toDestinationView) };
    },
  });
}

/**
 * Replaces the whole route of the caller's trip. One command rather than add, move and remove: the board sends
 * its current route, the result is atomic, and sending the same route twice changes nothing.
 */
export function createReplaceDestinations(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'replaceDestinations',
    kind: 'command',
    input: replaceDestinationsBody.extend({ tripId: tripIdSchema }),
    output: replaceDestinationsResult,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        await loadOwnedTrip(tx.trips, actor, input.tripId);
        const photos = await Promise.all(
          input.destinations.map((item, index) =>
            ownedPhotos(tx.media, actor, item.photos, `destinations.${index}.photos`),
          ),
        );
        // A stop keeps its id across saves (matched by its place key), so what points at it (the day plan's
        // places) survives the route being saved as a whole.
        const existing = new Map<string, string[]>();
        for (const record of await tx.destinations.listByTrip(input.tripId)) {
          existing.set(record.placeKey, [...(existing.get(record.placeKey) ?? []), record.id]);
        }
        const keep = (placeKey: string) => existing.get(placeKey)?.shift() ?? deps.ids.newId();
        const records = await tx.destinations.replaceForTrip(
          input.tripId,
          input.destinations.map((item, index) => ({
            id: keep(item.placeKey),
            placeKey: item.placeKey,
            name: item.name,
            countryCode: item.countryCode ?? null,
            region: item.region ?? null,
            latitude: item.latitude,
            longitude: item.longitude,
            nights: item.nights,
            note: item.note ?? null,
            // A leg leads to the next stop: the last stop has none.
            legMode: index === input.destinations.length - 1 ? null : (item.legMode ?? null),
            visited: item.visited,
            spotRoute: item.spotRoute,
            spots: item.spots,
            todos: item.todos,
            photos: photos[index]!,
          })),
          now,
        );
        // The first visited stop in a country stamps that country's visa. A visa is never taken back.
        const firsts = new Map<string, string>();
        for (const record of records) {
          if (record.visited && record.countryCode && !firsts.has(record.countryCode)) {
            firsts.set(record.countryCode, record.name);
          }
        }
        const stamped = await tx.visas.stampMissing(
          actor.userId,
          [...firsts].map(([countryCode, city]) => ({ countryCode, city })),
          now,
        );
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'destination.replace',
          entityType: 'trip',
          entityId: input.tripId,
          // How many stops, never which places (where someone plans to go is personal).
          metadata: { count: records.length },
        });
        if (stamped.length) {
          await tx.audit.record({
            id: deps.ids.newId(),
            occurredAt: now,
            actor,
            action: 'visa.stamp',
            entityType: 'trip',
            entityId: input.tripId,
            // How many, never which countries or cities.
            metadata: { count: stamped.length },
          });
        }
        return {
          destinations: records.map(toDestinationView),
          stampedVisas: stamped.map(toVisaView),
        };
      });
    },
  });
}

/** The caller's commemorative visas, newest first. */
export function createListVisas(deps: Pick<Ports, 'visas'>) {
  return defineOperation({
    name: 'listVisas',
    kind: 'query',
    input: z.object({}),
    output: visaListSchema,
    async handler(actor) {
      const records = await deps.visas.listByUser(actor.userId);
      return { visas: records.map(toVisaView) };
    },
  });
}
