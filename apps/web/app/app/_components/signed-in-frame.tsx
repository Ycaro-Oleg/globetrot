import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { loginRedirect } from '../../../lib/app-gate';
import { fetchCurrentUser } from '../../../lib/current-user';
import { isPipEnabled } from '../../../lib/flags';
import { fetchStoredPreferences, sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { AppShell } from './app-shell';

/**
 * Every signed-in page sits in the same shell (the app under `/app` and the account's settings). It reads the
 * person and their trips once, and sends a visitor without a session to log in, then back to `returnTo`.
 */
export async function SignedInFrame({
  returnTo,
  children,
}: {
  returnTo: string;
  children: ReactNode;
}) {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const [user, fetchedTrips, preferences] = await Promise.all([
    options ? fetchCurrentUser(options) : Promise.resolve(null),
    options ? fetchTrips(options) : Promise.resolve(null),
    options ? fetchStoredPreferences(options) : Promise.resolve(null),
  ]);
  if (!user) redirect(loginRedirect(returnTo));

  const trips = fetchedTrips ?? [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const activeTrip = trips.find((trip) => trip.id === savedId) ?? trips[0] ?? null;

  return (
    <AppShell
      userName={user.name}
      pipEnabled={isPipEnabled()}
      trips={trips}
      activeTripId={activeTrip?.id ?? null}
      pipLook={preferences?.pipLook ?? null}
      pipName={preferences?.pipName ?? null}
    >
      {children}
    </AppShell>
  );
}
