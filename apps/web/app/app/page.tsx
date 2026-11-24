import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiInternalUrl } from '../../lib/api-proxy';
import { sessionCookieHeader } from '../../lib/stored-preferences';
import { fetchTrips } from '../../lib/trips';

/** Home of the app: the map of the current trip, or the onboarding when there is no trip yet. */
export default async function AppHome() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const trips = cookieHeader ? await fetchTrips({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
  // `null` means the list could not be read: go to the board, which says so, rather than restart onboarding.
  if (trips !== null && trips.length === 0) redirect('/onboarding');
  redirect('/app/board');
}
