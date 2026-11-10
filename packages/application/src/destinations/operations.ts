import { z } from 'zod';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadOwnedTrip } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import { destinationListSchema, replaceDestinationsBody, toDestinationView } from './schemas';

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
    output: destinationListSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        await loadOwnedTrip(tx.trips, actor, input.tripId);
        const records = await tx.destinations.replaceForTrip(
          input.tripId,
          input.destinations.map((item) => ({
            id: deps.ids.newId(),
            placeKey: item.placeKey,
            name: item.name,
            countryCode: item.countryCode ?? null,
            region: item.region ?? null,
            latitude: item.latitude,
            longitude: item.longitude,
            nights: item.nights,
          })),
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
        return { destinations: records.map(toDestinationView) };
      });
    },
  });
}
