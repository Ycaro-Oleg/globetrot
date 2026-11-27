import { toLocalDate, tripDays, type TripDay } from '@globetrot/domain';
import { getLocale } from 'next-intl/server';
import {
  loadCurrentDayPlaces,
  loadCurrentDestinations,
  loadCurrentTrip,
} from '../../../lib/current-trip';
import { createServerApiClient } from '../../../lib/stored-preferences';
import type { DayIdeas } from './actions';
import type { BoardPlace, BoardStop } from './day-board';
import type { MapSpot } from './days-view';

export type DaysData = {
  readonly trip: {
    readonly id: string;
    readonly title: string;
    readonly startDate: string | null;
  } | null;
  readonly stops: readonly BoardStop[];
  readonly days: readonly TripDay[];
  readonly places: readonly BoardPlace[] | null;
  readonly ideas: DayIdeas | null;
  readonly mapSpots: readonly MapSpot[];
};

/**
 * The current trip's days (one per night of the route, plus the departure day) and what is planned on each, for
 * the itinerary in the trip's document.
 */
export async function loadDays(): Promise<DaysData> {
  const [{ options, trip }, locale] = await Promise.all([loadCurrentTrip(), getLocale()]);
  const [destinations, plan, ideas] =
    options && trip
      ? await Promise.all([
          loadCurrentDestinations(),
          loadCurrentDayPlaces(),
          createServerApiClient(options)
            .GET('/v1/trips/{id}/day-ideas', {
              params: {
                path: { id: trip.id },
                query: { language: locale === 'pt-BR' ? 'pt-BR' : 'en' },
              },
            })
            .then((response) => response.data ?? null)
            .catch(() => null),
        ])
      : [null, null, null];

  const stops = (destinations ?? []).map((stop) => ({
    id: stop.id,
    name: stop.name,
    nights: stop.nights,
    legMode: stop.legMode ?? null,
  }));
  // What the person marked on the map for each stop (not where they sleep or arrive): ready to put on a day.
  const mapSpots = (destinations ?? []).flatMap((stop) =>
    (stop.spots ?? [])
      .filter((spot) => spot.kind !== 'stay' && spot.kind !== 'transport')
      .map((spot) => ({ stopId: stop.id, name: spot.name, kind: spot.kind ?? 'sight' })),
  );
  const startDate = trip?.startDate ?? null;
  const days = tripDays({
    startDate: startDate ? toLocalDate(startDate) : null,
    stops: stops.map((stop) => ({
      id: stop.id,
      nights: stop.nights,
      state: 'planned',
      places: [],
    })),
  });
  return {
    trip: trip ? { id: trip.id, title: trip.title, startDate } : null,
    stops,
    days,
    places: plan?.places ?? null,
    ideas,
    mapSpots,
  };
}
