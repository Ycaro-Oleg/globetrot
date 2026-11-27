import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { partnersFromEnv } from '../../../lib/partners';
import { TodayView } from './today-view';

export async function generateMetadata() {
  const t = await getTranslations('todayPage');
  return { title: t('title') };
}

/**
 * Today (ADR-0026): the current trip at a glance, made to open often. The countdown and what to do in this phase,
 * this week's saving check-in with the streak and, while travelling, the way to today's plan and costs.
 */
export default async function TodayPage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const habit =
    options && trip
      ? await createServerApiClient(options)
          .GET('/v1/trips/{id}/habit', { params: { path: { id: trip.id } } })
          .then((response) => response.data ?? null)
          .catch(() => null)
      : null;
  return (
    <TodayView
      trip={trip ? { id: trip.id, title: trip.title, canEdit: trip.role !== 'viewer' } : null}
      habit={habit}
      partners={partnersFromEnv()}
    />
  );
}
