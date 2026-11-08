import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../lib/api-proxy';
import { fetchCurrentUser } from '../../lib/current-user';
import { sessionCookieHeader } from '../../lib/stored-preferences';
import { SITE_NAME } from '../site';
import { SignOutButton } from './sign-out-button';

/**
 * Placeholder for the signed-in app: the shell, navigation and trips arrive with later issues. It exists so that
 * logging in has somewhere to land and the access rule can be exercised.
 */
export default async function AppHome() {
  const [t, store] = await Promise.all([getTranslations('app'), cookies()]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const user = cookieHeader
    ? await fetchCurrentUser({ cookieHeader, apiUrl: apiInternalUrl() })
    : null;

  return (
    <main>
      <h1>{SITE_NAME}</h1>
      <h2>{t('welcome', { name: user?.name ?? '' })}</h2>
      <p>{t('description')}</p>
      <p>
        <Link href="/settings">{t('settings')}</Link>
      </p>
      <SignOutButton />
    </main>
  );
}
