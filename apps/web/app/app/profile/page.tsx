import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchCurrentUser } from '../../../lib/current-user';
import { fetchStoredPreferences, sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchTrips, fetchVisas } from '../../../lib/trips';
import { ProfileView } from './profile-view';

export async function generateMetadata() {
  const t = await getTranslations('profilePage');
  return { title: t('title') };
}

/** The person's own profile (design handoff v2, "Profile"): their Pip, the "My Pip" editor and their visas. */
export default async function ProfilePage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const [user, preferences, trips, visas] = options
    ? await Promise.all([
        fetchCurrentUser(options),
        fetchStoredPreferences(options),
        fetchTrips(options),
        fetchVisas(options),
      ])
    : [null, null, null, null];
  return (
    <ProfileView
      name={user?.name ?? ''}
      homeCity={preferences?.homeCity ?? null}
      look={preferences?.pipLook ?? null}
      pipName={preferences?.pipName ?? null}
      tripCount={trips?.length ?? 0}
      visas={visas}
    />
  );
}
