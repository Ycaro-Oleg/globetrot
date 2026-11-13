import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../lib/api-proxy';
import { fetchCurrentUser } from '../../lib/current-user';
import { fetchStoredPreferences, sessionCookieHeader } from '../../lib/stored-preferences';
import { SITE_NAME } from '../site';
import { OnboardingFlow } from './onboarding-flow';

// Depends on the visitor's cookies, so it is rendered per request.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('onboarding');
  return { title: `${t('title')} · ${SITE_NAME}` };
}

/** The first trip in seven steps (design handoff v2, "Onboarding"). Signed in only. */
export default async function OnboardingPage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const [user, preferences] = await Promise.all([
    options ? fetchCurrentUser(options) : Promise.resolve(null),
    options ? fetchStoredPreferences(options) : Promise.resolve(null),
  ]);
  if (!user) redirect('/login?next=%2Fonboarding');
  return (
    <OnboardingFlow
      currency={preferences?.currency ?? 'USD'}
      homeCity={preferences?.homeCity ?? ''}
      pipOptIn={preferences?.pipOptIn ?? false}
    />
  );
}
