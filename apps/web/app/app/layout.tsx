import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { apiInternalUrl } from '../../lib/api-proxy';
import { loginRedirect } from '../../lib/app-gate';
import { fetchCurrentUser } from '../../lib/current-user';
import { isPipEnabled } from '../../lib/flags';
import { fetchTrips, SELECTED_TRIP_COOKIE } from '../../lib/trips';
import { sessionCookieHeader } from '../../lib/stored-preferences';
import { AppShell } from './_components/app-shell';

// Depends on the visitor's cookies, so it is rendered per request.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const [user, fetchedTrips] = await Promise.all([
    options ? fetchCurrentUser(options) : Promise.resolve(null),
    options ? fetchTrips(options) : Promise.resolve(null),
  ]);
  if (!user) redirect(loginRedirect('/app'));

  const trips = fetchedTrips ?? [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const activeTrip = trips.find((trip) => trip.id === savedId) ?? trips[0] ?? null;

  return (
    <AppShell
      userName={user.name}
      pipEnabled={isPipEnabled()}
      trips={trips}
      activeTripId={activeTrip?.id ?? null}
    >
      {children}
    </AppShell>
  );
}
