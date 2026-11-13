import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchCommunityMe, fetchDiscover, fetchFeed } from '../../../lib/community';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import {
  fetchDestinations,
  fetchTrips,
  fetchVisas,
  SELECTED_TRIP_COOKIE,
} from '../../../lib/trips';
import { CommunityView } from './community-view';

export async function generateMetadata() {
  const t = await getTranslations('communityPage');
  return { title: t('title') };
}

/** The community feed ("For you" or "Following"), the composer and the discover column. */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const [store, query] = await Promise.all([cookies(), searchParams]);
  const feedName = query.feed === 'following' ? 'following' : 'all';
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  if (!options) return null;
  const [feed, discover, me, trips, visas] = await Promise.all([
    fetchFeed(options, feedName),
    fetchDiscover(options),
    fetchCommunityMe(options),
    fetchTrips(options),
    fetchVisas(options),
  ]);
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const current = trips?.find((trip) => trip.id === savedId) ?? trips?.[0] ?? null;
  const stops = current ? ((await fetchDestinations(options, current.id)) ?? []) : [];

  return (
    <CommunityView
      feedName={feedName}
      feed={feed}
      discover={discover}
      me={me}
      trips={(trips ?? []).map((trip) => ({ id: trip.id, title: trip.title }))}
      currentTrip={current ? { id: current.id, title: current.title } : null}
      visas={(visas ?? []).map((visa) => ({ countryCode: visa.countryCode, city: visa.city }))}
      places={stops.map((stop) => ({ name: stop.name, countryCode: stop.countryCode }))}
    />
  );
}
