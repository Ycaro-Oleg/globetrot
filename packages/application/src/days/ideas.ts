import {
  POPULAR_PLACES,
  popularSightsFor,
  SIGHT_KINDS,
  SIGHT_MINUTES,
  type SightKind,
} from '@globetrot/domain';
import { z } from 'zod';
import { RateLimitedError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';

/** Stops that get ideas, in route order: enough for a long trip, few enough to keep the provider calls small. */
export const IDEAS_MAX_STOPS = 6;
export const IDEAS_PER_STOP = 6;
const IDEAS_PER_MINUTE = 20;

export const dayIdeasSchema = z.object({
  stops: z.array(
    z.object({
      stopId: z.string(),
      ideas: z.array(
        z.object({ name: z.string(), kind: z.enum(SIGHT_KINDS), minutes: z.number().int() }),
      ),
      /** Where the ideas come from: the places provider (with its credit) or Globetrot's own short list. */
      source: z.enum(['provider', 'built-in']).nullable(),
      attribution: z.string().nullable(),
    }),
  ),
});

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** The built-in city a stop stands for: its `gt:` key, or a popular city with exactly its name. */
function builtInCity(placeKey: string, name: string): string | null {
  if (placeKey.startsWith('gt:')) return placeKey;
  const wanted = fold(name);
  return POPULAR_PLACES.find((p) => fold(p.en) === wanted || fold(p.pt) === wanted)?.key ?? null;
}

/**
 * Places worth a visit near each stop, for the Days screen: from the places provider when it is configured,
 * otherwise from the built-in list for popular cities. Places already on the plan are left out. Ideas are only
 * suggestions: adding one puts it in "No day" with a typical time the person can change.
 */
export function createSuggestDayPlaces(
  deps: Pick<Ports, 'trips' | 'destinations' | 'dayPlaces' | 'geocoding' | 'rateLimiter'>,
) {
  return defineOperation({
    name: 'suggestDayPlaces',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema, language: z.enum(['en', 'pt-BR']).default('en') }),
    output: dayIdeasSchema,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      if (!deps.rateLimiter.consume(`ideas:${actor.userId}`, IDEAS_PER_MINUTE)) {
        throw new RateLimitedError();
      }
      const [stops, planned] = await Promise.all([
        deps.destinations.listByTrip(trip.id),
        deps.dayPlaces.listByTrip(trip.id),
      ]);
      const taken = new Set(planned.map((place) => fold(place.name)));
      const ordered = [...stops].sort((a, b) => a.position - b.position).slice(0, IDEAS_MAX_STOPS);

      const result = await Promise.all(
        ordered.map(async (stop) => {
          const fresh = (items: { name: string; kind: SightKind }[]) =>
            items
              .filter((item) => !taken.has(fold(item.name)))
              .slice(0, IDEAS_PER_STOP)
              .map((item) => ({ ...item, minutes: SIGHT_MINUTES[item.kind] }));

          const found = await deps.geocoding.sights(
            { latitude: stop.latitude, longitude: stop.longitude },
            { language: input.language, limit: 12 },
          );
          if (found && found.length > 0) {
            return {
              stopId: stop.id,
              ideas: fresh(found),
              source: 'provider' as const,
              attribution: found[0]!.attribution,
            };
          }
          const city = builtInCity(stop.placeKey, stop.name);
          const builtIn = city
            ? popularSightsFor(city).map((sight) => ({
                name: input.language === 'pt-BR' ? sight.pt : sight.en,
                kind: sight.kind,
              }))
            : [];
          return {
            stopId: stop.id,
            ideas: fresh(builtIn),
            source: builtIn.length > 0 ? ('built-in' as const) : null,
            attribution: null,
          };
        }),
      );
      return { stops: result };
    },
  });
}
