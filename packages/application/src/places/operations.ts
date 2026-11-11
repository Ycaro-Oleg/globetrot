import { z } from 'zod';
import { RateLimitedError, UnavailableError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';

/** Searches and reverse lookups a person may make each minute (shared by both). */
export const PLACE_LOOKUPS_PER_MINUTE = 60;

const languageSchema = z
  .enum(['en', 'pt-BR'])
  .default('en')
  .meta({ description: 'Language for place names.' });

export const placeSchema = z.object({
  key: z.string().meta({ description: 'Stable key of the place (use it as `placeKey`).' }),
  name: z.string(),
  countryCode: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  attribution: z.string().meta({ example: '© OpenStreetMap contributors · Geoapify' }),
});

export const searchPlacesInput = z.object({
  query: z.string().trim().min(2).max(100).meta({ example: 'Kyoto' }),
  language: languageSchema,
});
export const reversePlaceInput = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  language: languageSchema,
});

const provider = (language: string) => (language === 'pt-BR' ? 'pt' : 'en');

function allow(deps: Pick<Ports, 'rateLimiter'>, userId: string) {
  if (!deps.rateLimiter.consume(`places:${userId}`, PLACE_LOOKUPS_PER_MINUTE))
    throw new RateLimitedError();
}

/** Place search for the board. The provider key never leaves the server; queries are not logged or audited. */
export function createSearchPlaces(deps: Pick<Ports, 'geocoding' | 'rateLimiter'>) {
  return defineOperation({
    name: 'searchPlaces',
    kind: 'query',
    input: searchPlacesInput,
    output: z.object({ places: z.array(placeSchema) }),
    async handler(actor, input) {
      allow(deps, actor.userId);
      const places = await deps.geocoding.search(input.query, {
        language: provider(input.language),
        limit: 8,
      });
      if (places === null) throw new UnavailableError('Place search is not available right now');
      return { places };
    },
  });
}

/** The place at a point (a pin dropped on the map, or "Pin here"). `place` is null when nothing is there. */
export function createReversePlace(deps: Pick<Ports, 'geocoding' | 'rateLimiter'>) {
  return defineOperation({
    name: 'reversePlace',
    kind: 'query',
    input: reversePlaceInput,
    output: z.object({ place: placeSchema.nullable() }),
    async handler(actor, input) {
      allow(deps, actor.userId);
      const place = await deps.geocoding.reverse(
        { latitude: input.latitude, longitude: input.longitude },
        { language: provider(input.language) },
      );
      if (place === undefined)
        throw new UnavailableError('Place lookup is not available right now');
      return { place };
    },
  });
}
