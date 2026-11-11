import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchChecklist, fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { ListsView } from './lists-view';

export async function generateMetadata() {
  const t = await getTranslations('listsPage');
  return { title: t('title') };
}

/** The checklists and the visa page (readiness stamps) of the current trip. */
export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [store, query] = await Promise.all([cookies(), searchParams]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const checklist = options && trip ? await fetchChecklist(options, trip.id) : null;

  return (
    <ListsView
      trip={trip ? { id: trip.id, title: trip.title } : null}
      checklist={checklist}
      status={query.status}
    />
  );
}
