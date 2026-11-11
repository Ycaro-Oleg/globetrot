import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchDestinations, fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { isLegMode, type RouteStop } from './board-route';
import { WorldMapBoard } from './world-map';

export async function generateMetadata() {
  const t = await getTranslations('mapBoard');
  return { title: t('title') };
}

/**
 * The board of the current trip: its saved route is loaded on the server, so the first paint already has the
 * stops, and the board saves every change back to the trip. Without a trip it still works, unsaved.
 */
export default async function BoardPage() {
  const [store, locale] = await Promise.all([cookies(), getLocale()]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const destinations = options && trip ? ((await fetchDestinations(options, trip.id)) ?? []) : [];

  const countries = new Intl.DisplayNames([locale], { type: 'region' });
  const route: RouteStop[] = destinations.map((stop) => ({
    id: stop.placeKey,
    name: stop.name,
    country: stop.countryCode ? (countries.of(stop.countryCode) ?? '') : '',
    countryCode: stop.countryCode ?? '',
    region: stop.region ?? '',
    longitude: stop.longitude,
    latitude: stop.latitude,
    nights: stop.nights,
    note: stop.note ?? '',
    legMode: isLegMode(stop.legMode) ? stop.legMode : null,
  }));

  return <WorldMapBoard key={trip?.id ?? 'none'} tripId={trip?.id ?? null} initialRoute={route} />;
}
