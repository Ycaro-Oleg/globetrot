import { tripDays, toLocalDate } from '@globetrot/domain';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import {
  fetchDayPlaces,
  fetchDestinations,
  fetchTrips,
  SELECTED_TRIP_COOKIE,
} from '../../../lib/trips';
import { DaysView } from './days-view';

export async function generateMetadata() {
  const t = await getTranslations('daysPage');
  return { title: t('title') };
}

/** The days of the current trip (one per night of the route) and the places planned on each. */
export default async function DaysPage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const [destinations, plan] =
    options && trip
      ? await Promise.all([fetchDestinations(options, trip.id), fetchDayPlaces(options, trip.id)])
      : [null, null];

  const stops = (destinations ?? []).map((stop) => ({
    id: stop.id,
    name: stop.name,
    nights: stop.nights,
    legMode: stop.legMode ?? null,
  }));
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
  return (
    <DaysView
      trip={trip ? { id: trip.id, title: trip.title, startDate } : null}
      stops={stops}
      days={days}
      places={plan?.places ?? null}
    />
  );
}
