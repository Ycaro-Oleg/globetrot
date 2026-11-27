import { catalogs, isSupportedLocale } from '@globetrot/i18n';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { getStoredPreferences } from '../lib/request-preferences';
import { chooseLocale, LOCALE_COOKIE } from './locale';

export default getRequestConfig(async ({ locale: requested }) => {
  const store = await cookies();

  // Only a signed-in visitor has stored settings, so anonymous requests make no API call.
  const stored = await getStoredPreferences();

  // A page that names its language (a shared trip's image in its owner's language, an itinerary at its
  // Portuguese or English address) gets that one; everything else follows the visitor.
  const locale =
    requested && isSupportedLocale(requested)
      ? requested
      : chooseLocale(store.get(LOCALE_COOKIE)?.value, stored);
  // The user's own time zone when they set one; UTC otherwise, which keeps server and client markup
  // identical (next-intl warns otherwise). Calendar dates are time-zone-free either way.
  return { locale, messages: catalogs[locale], timeZone: stored?.timeZone ?? 'UTC' };
});
