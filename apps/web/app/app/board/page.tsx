import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { isPipEnabled } from '../../../lib/flags';
import {
  createServerApiClient,
  fetchStoredPreferences,
  sessionCookieHeader,
} from '../../../lib/stored-preferences';
import {
  fetchDestinations,
  fetchTrips,
  fetchVisas,
  SELECTED_TRIP_COOKIE,
} from '../../../lib/trips';
import { fromDestination, type RouteStop } from './board-route';
import { partnersFromEnv } from '../../../lib/partners';
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
  const pipEnabled = isPipEnabled();
  const [destinations, visas, proposals, preferences] = await Promise.all([
    options && trip ? fetchDestinations(options, trip.id) : Promise.resolve(null),
    options ? fetchVisas(options) : Promise.resolve(null),
    options && trip && pipEnabled
      ? createServerApiClient(options)
          .GET('/v1/trips/{id}/pip/proposals', { params: { path: { id: trip.id } } })
          .then((answer) => answer.data?.proposals ?? [])
          .catch(() => [])
      : Promise.resolve([]),
    options ? fetchStoredPreferences(options) : Promise.resolve(null),
  ]);
  const home =
    preferences?.homeCity && preferences.homePoint
      ? { name: preferences.homeCity, ...preferences.homePoint }
      : null;
  // The newest proposal still waiting for a decision: its new stops are pencilled on the map.
  const waiting = proposals.find((proposal) => proposal.status === 'proposed');
  const pipSuggestion = waiting
    ? {
        count: waiting.changes.length,
        stops: waiting.changes.flatMap((change) =>
          change.kind === 'addStop'
            ? [
                {
                  name: change.name,
                  latitude: change.latitude,
                  longitude: change.longitude,
                  nights: change.nights,
                },
              ]
            : [],
        ),
      }
    : null;

  const route: RouteStop[] = (destinations ?? []).map(fromDestination);

  return (
    <WorldMapBoard
      key={trip?.id ?? 'none'}
      tripId={trip?.id ?? null}
      tripTitle={trip?.title ?? null}
      startDate={trip?.startDate ?? null}
      initialRoute={route}
      initialVisas={(visas ?? []).map((visa) => visa.countryCode)}
      pipEnabled={pipEnabled}
      pipSuggestion={pipSuggestion}
      home={home}
      partners={partnersFromEnv()}
    />
  );
}
