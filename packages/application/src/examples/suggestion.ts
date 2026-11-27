import {
  convert,
  DEFAULT_TRIP_STATUS,
  DEFAULT_TRIP_VISIBILITY,
  distanceKm,
  fromDecimal,
  SUGGEST_COMFORTS,
  SUGGEST_LIKES,
  SUGGEST_MAX_DAYS,
  SUGGEST_MIN_DAYS,
  SUGGEST_RATE_CURRENCIES,
  SUGGESTED_DESTINATIONS,
  suggestPlan,
  suggestReferenceRate,
  toCurrencyCode,
  type Money,
} from '@globetrot/domain';
import { SUPPORTED_LOCALES } from '@globetrot/i18n';
import { z } from 'zod';
import { assertTripRoom } from '../billing/rules';
import { canonicalJson } from '../canonical-json';
import { IdempotencyKeyReusedError, NotFoundError, ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { idempotencyKeySchema } from '../trips/operations';
import { createTripFields, toTripView, tripSchema } from '../trips/schemas';

const DESTINATION_IDS = SUGGESTED_DESTINATIONS.map((destination) => destination.id) as [
  string,
  ...string[],
];

/** A place stays on the stop's A→B→C route only when it is in town (a day trip far away would stretch it). */
const ROUTE_RADIUS_KM = 60;

export const createTripFromSuggestionFields = z.object({
  destination: z.enum(DESTINATION_IDS).meta({ description: 'Which suggested destination.' }),
  likes: z
    .array(z.enum(SUGGEST_LIKES))
    .max(SUGGEST_LIKES.length)
    .meta({ description: 'What the person enjoys; empty means everything.' }),
  days: z.number().int().min(SUGGEST_MIN_DAYS).max(SUGGEST_MAX_DAYS),
  comfort: z.enum(SUGGEST_COMFORTS),
  currency: z
    .string()
    .refine((code) => (SUGGEST_RATE_CURRENCIES as readonly string[]).includes(code), {
      error: 'A currency the suggested plans can show',
    })
    .meta({ description: 'The trip’s currency, as picked with the plan (USD by default).' }),
  monthly: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/)
    .optional()
    .meta({
      description: 'What the person plans to set aside each month, in the trip’s currency.',
    }),
  title: createTripFields.shape.title.optional().meta({
    description: 'The trip’s title in the person’s language. Defaults to the destination’s name.',
  }),
  estimateLabel: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .meta({ description: 'The description of the estimated cost, in the person’s language.' }),
  locale: z.enum(SUPPORTED_LOCALES).optional().meta({
    description: 'The language for the stops’ and places’ names (`pt-BR` uses Portuguese names).',
  }),
});

/**
 * Turns the plan someone built on the landing into their first trip (ADR-0020): the stops with their nights and the
 * way on, the suggested experiences as places on the map, the plan's typical cost as the trip's estimate (converted
 * at the recorded reference rate when the trip is not in USD) and the monthly amount they chose.
 */
export function createCreateTripFromSuggestion(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'createTripFromSuggestion',
    kind: 'command',
    input: createTripFromSuggestionFields.extend({
      idempotencyKey: idempotencyKeySchema.optional(),
    }),
    output: tripSchema,
    async handler(actor, input) {
      const plan = suggestPlan(input);
      const destination = SUGGESTED_DESTINATIONS.find((place) => place.id === input.destination);
      if (!plan || !destination) throw new NotFoundError();
      const pt = input.locale === 'pt-BR';
      const now = deps.clock.now();
      const title = input.title ?? (pt ? destination.namePt : destination.name);
      const currency = toCurrencyCode(input.currency);
      const key = input.idempotencyKey;

      // The estimate is researched in USD; another currency reads it at the recorded reference rate.
      const rate = suggestReferenceRate(currency);
      const estimate: Money = plan.estimate.middle;
      const inTripCurrency = rate ? convert(estimate, rate).converted : estimate;
      let monthlyMinor: bigint | undefined;
      if (input.monthly !== undefined) {
        try {
          monthlyMinor = fromDecimal(input.monthly, currency, {
            rounding: 'half-even',
          }).amountMinor;
        } catch {
          throw new ValidationError([
            { field: 'monthly', code: 'invalid_format', message: 'Not an amount' },
          ]);
        }
      }

      return deps.unitOfWork.run(async (tx) => {
        if (key !== undefined) {
          const start = await tx.idempotency.begin({
            ownerId: actor.userId,
            key,
            fingerprint: `createTripFromSuggestion ${canonicalJson({ ...input, idempotencyKey: null })}`,
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
          currency,
          status: DEFAULT_TRIP_STATUS,
          visibility: DEFAULT_TRIP_VISIBILITY,
          createdAt: now,
        });
        await tx.destinations.replaceForTrip(
          trip.id,
          plan.stops.map(({ stop, nights, experiences, next }) => ({
            id: deps.ids.newId(),
            placeKey: `suggest:${stop.key}`,
            name: pt ? stop.namePt : stop.name,
            countryCode: stop.countryCode,
            region: stop.region,
            latitude: stop.latitude,
            longitude: stop.longitude,
            nights,
            legMode: next?.mode ?? null,
            note: null,
            visited: false,
            spotRoute:
              experiences.length > 1 &&
              experiences.every((experience) => distanceKm(stop, experience) < ROUTE_RADIUS_KM),
            spots: experiences.map((experience) => ({
              name: pt ? experience.namePt : experience.name,
              kind: experience.kind,
              latitude: experience.latitude,
              longitude: experience.longitude,
              done: false,
            })),
            todos: [],
            photos: [],
          })),
          now,
        );
        await tx.expenses.insert({
          id: deps.ids.newId(),
          tripId: trip.id,
          category: 'other',
          status: 'estimate',
          description: input.estimateLabel ?? (pt ? 'Estimativa do plano' : 'Plan estimate'),
          currency: estimate.currency,
          guess: true,
          createdAt: now,
          amountMinor: estimate.amountMinor,
          tripAmountMinor: inTripCurrency.amountMinor,
          fxRate: rate ? rate.rate : null,
          fxSource: rate ? rate.source : null,
          fxAsOf: rate ? rate.asOf.toISOString().slice(0, 10) : null,
        });
        if (monthlyMinor !== undefined) {
          await tx.savings.upsert(trip.id, { monthlyMinor }, now);
        }
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.create',
          entityType: 'trip',
          entityId: trip.id,
          // Which public plan was used is not personal; the amounts stay out.
          metadata: { fromSuggestion: destination.id, days: plan.days },
        });
        const view = toTripView(trip);
        if (key !== undefined) await tx.idempotency.complete(actor.userId, key, view);
        return view;
      });
    },
  });
}
