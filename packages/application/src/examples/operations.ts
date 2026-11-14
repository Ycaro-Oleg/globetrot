import { assertTripRoom } from '../billing/rules';
import { DEFAULT_CURRENCY, DEFAULT_TRIP_STATUS, DEFAULT_TRIP_VISIBILITY } from '@globetrot/domain';
import { z } from 'zod';
import { canonicalJson } from '../canonical-json';
import { IdempotencyKeyReusedError, NotFoundError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { idempotencyKeySchema } from '../trips/operations';
import { createTripFields, toTripView, tripSchema } from '../trips/schemas';
import { EXAMPLE_TRIP_IDS, findExampleTrip } from './catalog';

export const createTripFromExampleFields = z.object({
  exampleId: z.enum(EXAMPLE_TRIP_IDS).meta({ description: 'Which example to copy.' }),
  title: createTripFields.shape.title.optional().meta({
    description:
      'The trip’s title in the person’s language. Defaults to the example’s English title.',
  }),
});

/**
 * Copies an example trip into the actor's account: a new private trip in USD (the default currency, never inferred)
 * with the example's route and nights. The copy is the person's own from then on.
 */
export function createCreateTripFromExample(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'createTripFromExample',
    kind: 'command',
    input: createTripFromExampleFields.extend({ idempotencyKey: idempotencyKeySchema.optional() }),
    output: tripSchema,
    async handler(actor, input) {
      const example = findExampleTrip(input.exampleId);
      if (!example) throw new NotFoundError();
      const now = deps.clock.now();
      const title = input.title ?? example.defaultTitle;
      const key = input.idempotencyKey;

      return deps.unitOfWork.run(async (tx) => {
        if (key !== undefined) {
          const start = await tx.idempotency.begin({
            ownerId: actor.userId,
            key,
            fingerprint: `createTripFromExample ${canonicalJson({ exampleId: example.id, title })}`,
            createdAt: now,
          });
          if (start.state === 'mismatch') throw new IdempotencyKeyReusedError();
          if (start.state === 'replay') return tripSchema.parse(start.response);
        }
        await assertTripRoom(tx, actor, now);
        const trip = await tx.trips.insert({
          id: deps.ids.newId(),
          ownerId: actor.userId,
          title,
          startDate: null,
          currency: DEFAULT_CURRENCY,
          status: DEFAULT_TRIP_STATUS,
          visibility: DEFAULT_TRIP_VISIBILITY,
          createdAt: now,
        });
        await tx.destinations.replaceForTrip(
          trip.id,
          example.stops.map((stop) => ({
            id: deps.ids.newId(),
            ...stop,
            note: null,
            visited: false,
            spots: [],
            todos: [],
            photos: [],
          })),
          now,
        );
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.create',
          entityType: 'trip',
          entityId: trip.id,
          // Which public example was copied is not personal.
          metadata: { fromExample: example.id },
        });
        const view = toTripView(trip);
        if (key !== undefined) await tx.idempotency.complete(actor.userId, key, view);
        return view;
      });
    },
  });
}
