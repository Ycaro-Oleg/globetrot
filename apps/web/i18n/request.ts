import { catalogs } from '@globetrot/i18n';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, resolveWebLocale } from './locale';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveWebLocale(store.get(LOCALE_COOKIE)?.value);
  // `timeZone` is a user preference that does not exist yet (preferences slice). Until then, UTC keeps
  // server and client markup identical (next-intl warns otherwise). Calendar dates stay time-zone-free.
  return { locale, messages: catalogs[locale], timeZone: 'UTC' };
});
