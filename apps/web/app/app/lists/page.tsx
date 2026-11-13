import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import {
  fetchChecklist,
  fetchDestinations,
  fetchTrips,
  fetchVisas,
  SELECTED_TRIP_COOKIE,
} from '../../../lib/trips';
import { ListsView } from './lists-view';

export async function generateMetadata() {
  const t = await getTranslations('listsPage');
  return { title: t('title') };
}

/** The checklists of the current trip and its passport tab (visas and the trip's stamps). */
export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [store, query] = await Promise.all([cookies(), searchParams]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const [checklist, visas, destinations] =
    options && trip
      ? await Promise.all([
          fetchChecklist(options, trip.id),
          fetchVisas(options),
          fetchDestinations(options, trip.id),
        ])
      : [null, null, null];
  // Countries on the route, in route order, once each: the passport shows those not stamped yet as planned.
  const routeCountries = [
    ...new Set((destinations ?? []).map((stop) => stop.countryCode).filter(Boolean)),
  ] as string[];

  return (
    <ListsView
      trip={trip ? { id: trip.id, title: trip.title } : null}
      checklist={checklist}
      visas={visas ?? []}
      routeCountries={routeCountries}
      initialTab={query.tab === 'passport' ? 'passport' : 'lists'}
    />
  );
}
