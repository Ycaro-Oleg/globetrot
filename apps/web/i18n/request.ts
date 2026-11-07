import { catalogs } from '@globetrot/i18n';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { apiInternalUrl } from '../lib/api-proxy';
import { fetchStoredPreferences, sessionCookieHeader } from '../lib/stored-preferences';
import { chooseLocale, LOCALE_COOKIE } from './locale';

export default getRequestConfig(async () => {
  const store = await cookies();

  // Only a signed-in visitor has stored settings, so anonymous requests make no API call.
  const cookieHeader = sessionCookieHeader(store.getAll());
  const stored = cookieHeader
    ? await fetchStoredPreferences({ cookieHeader, apiUrl: apiInternalUrl() })
    : null;

  const locale = chooseLocale(store.get(LOCALE_COOKIE)?.value, stored);
  // The user's own time zone when they set one; UTC otherwise, which keeps server and client markup
  // identical (next-intl warns otherwise). Calendar dates are time-zone-free either way.
  return { locale, messages: catalogs[locale], timeZone: stored?.timeZone ?? 'UTC' };
});
