import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiInternalUrl } from '../../lib/api-proxy';
import { PLAN_DRAFT_COOKIE, readDraft } from '../../lib/plan-draft';
import { sessionCookieHeader } from '../../lib/stored-preferences';
import { fetchTrips } from '../../lib/trips';

/**
 * Home of the app: the current trip's workspace (its document beside the map); with no trip yet, the plan built on the landing becomes the trip
 * (`/app/start`), and without one the short onboarding asks for it.
 */
export default async function AppHome() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const trips = cookieHeader ? await fetchTrips({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
  // `null` means the list could not be read: go to the trip, which says so, rather than restart onboarding.
  if (trips !== null && trips.length === 0) {
    redirect(
      readDraft(store.get(PLAN_DRAFT_COOKIE)?.value)?.suggestion ? '/app/start' : '/onboarding',
    );
  }
  redirect('/app/trip');
}
