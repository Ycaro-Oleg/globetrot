import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import {
  fetchDestinations,
  fetchTrips,
  fetchVisas,
  SELECTED_TRIP_COOKIE,
} from '../../../lib/trips';
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
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const [destinations, visas] = await Promise.all([
    options && trip ? fetchDestinations(options, trip.id) : Promise.resolve(null),
    options ? fetchVisas(options) : Promise.resolve(null),
  ]);

  const route: RouteStop[] = (destinations ?? []).map((stop) => ({
    id: stop.placeKey,
    name: stop.name,
    countryCode: stop.countryCode ?? '',
    region: stop.region ?? '',
    longitude: stop.longitude,
    latitude: stop.latitude,
    nights: stop.nights,
    note: stop.note ?? '',
    legMode: isLegMode(stop.legMode) ? stop.legMode : null,
    visited: stop.visited ?? false,
    spots: (stop.spots ?? []).map((spot) => ({ ...spot })),
    todos: (stop.todos ?? []).map((todo) => ({ ...todo })),
  }));

  return (
    <WorldMapBoard
      key={trip?.id ?? 'none'}
      tripId={trip?.id ?? null}
      tripTitle={trip?.title ?? null}
      startDate={trip?.startDate ?? null}
      initialRoute={route}
      initialVisas={(visas ?? []).map((visa) => visa.countryCode)}
    />
  );
}
