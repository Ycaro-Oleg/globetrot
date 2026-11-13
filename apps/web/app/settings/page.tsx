import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Banner } from '@globetrot/ui/banner';
import { apiInternalUrl } from '../../lib/api-proxy';
import { fetchCurrentUser } from '../../lib/current-user';
import { fetchStoredPreferences, sessionCookieHeader } from '../../lib/stored-preferences';
import { countryOptions, currencyOptions, timeZoneOptions } from './options';
import { SettingsView } from './settings-view';

// Depends on the visitor's cookies, so it is rendered per request.
export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const [locale, t, store, query] = await Promise.all([
    getLocale(),
    getTranslations('settings'),
    cookies(),
    searchParams,
  ]);

  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const [stored, user] = options
    ? await Promise.all([fetchStoredPreferences(options), fetchCurrentUser(options)])
    : [null, null];

  // Settings belong to an account. The sign-in screens arrive with #57.
  if (!stored) {
    return (
      <section>
        <h1>{t('title')}</h1>
        <Banner tone="info" role="status">
          {t('signedOut')}
        </Banner>
      </section>
    );
  }

  return (
    <SettingsView
      values={stored}
      currencies={currencyOptions(locale)}
      countries={countryOptions(locale)}
      timeZones={timeZoneOptions(locale, stored.timeZone)}
      status={typeof query.status === 'string' ? query.status : undefined}
      email={user?.email ?? null}
    />
  );
}
