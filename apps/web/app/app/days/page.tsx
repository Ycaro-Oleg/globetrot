import { tripDays, toLocalDate } from '@globetrot/domain';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchDestinations, fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { DaysView } from './days-view';

export async function generateMetadata() {
  const t = await getTranslations('daysPage');
  return { title: t('title') };
}

/** The days of the current trip, derived from its start date and the nights at each stop. */
export default async function DaysPage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const destinations = options && trip ? ((await fetchDestinations(options, trip.id)) ?? []) : [];

  const stops = destinations.map((stop) => ({ id: stop.id, name: stop.name, nights: stop.nights }));
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
  return <DaysView trip={trip} stops={stops} days={days} startDate={startDate} />;
}
