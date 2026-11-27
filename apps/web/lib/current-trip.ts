import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiInternalUrl } from './api-proxy';
import type { FetchOptions } from './stored-preferences';
import { sessionCookieHeader } from './stored-preferences';
import {
  fetchDayPlaces,
  fetchDestinations,
  fetchTrips,
  SELECTED_TRIP_COOKIE,
  type DayPlanData,
  type DestinationView,
  type TripView,
} from './trips';

export type CurrentTrip = {
  /** How to reach the API as the signed-in person, or `null` without a session. */
  readonly options: FetchOptions | null;
  readonly trips: readonly TripView[];
  /** The trip chosen in the switcher (the cookie), else the first one, else `null`. */
  readonly trip: TripView | null;
};

/**
 * The current trip, read once per request: the trip workspace layout and the page inside it both ask for it,
 * and React's `cache` makes the second call free.
 */
export const loadCurrentTrip = cache(async (): Promise<CurrentTrip> => {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  return { options, trips, trip };
});

/** The current trip's route in order, once per request; `null` without a trip or when it cannot be read. */
export const loadCurrentDestinations = cache(async (): Promise<DestinationView[] | null> => {
  const { options, trip } = await loadCurrentTrip();
  return options && trip ? fetchDestinations(options, trip.id) : null;
});

/** The current trip's places to see and their days, once per request. */
export const loadCurrentDayPlaces = cache(async (): Promise<DayPlanData | null> => {
  const { options, trip } = await loadCurrentTrip();
  return options && trip ? fetchDayPlaces(options, trip.id) : null;
});
