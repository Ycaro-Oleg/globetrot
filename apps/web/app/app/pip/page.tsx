import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { isPipEnabled } from '../../../lib/flags';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchDestinations, fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { fetchBilling } from '../../../lib/billing';
import { SITE_NAME } from '../../site';
import { PipView } from './pip-view';

export async function generateMetadata() {
  const t = await getTranslations('pipPage');
  return { title: `${t('title')} · ${SITE_NAME}` };
}

/**
 * Pip, the optional companion: ask in your own words, review a change list, apply what you want, undo it.
 * Only behind the `FEATURE_PIP` flag; with the flag off it is a plain 404.
 */
const TOPIC_IDEAS = { board: 'slower', days: 'places', budget: 'costs', lists: 'packing' } as const;

export default async function PipPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  if (!isPipEnabled()) notFound();
  const { topic } = await searchParams;
  const idea =
    topic && topic in TOPIC_IDEAS ? TOPIC_IDEAS[topic as keyof typeof TOPIC_IDEAS] : null;
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const billing = options ? await fetchBilling(options) : null;
  const [stops, proposals] =
    options && trip
      ? await Promise.all([
          fetchDestinations(options, trip.id),
          createServerApiClient(options)
            .GET('/v1/trips/{id}/pip/proposals', { params: { path: { id: trip.id } } })
            .then((r) => r.data?.proposals ?? [])
            .catch(() => []),
        ])
      : [null, []];
  return (
    <PipView
      trip={trip ? { id: trip.id, title: trip.title, currency: trip.currency } : null}
      stops={(stops ?? []).map((stop) => ({ id: stop.id, name: stop.name }))}
      initial={proposals}
      idea={idea}
      credits={billing?.credits.total ?? null}
    />
  );
}
