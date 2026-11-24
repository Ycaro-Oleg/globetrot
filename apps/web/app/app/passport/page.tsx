import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchVisas } from '../../../lib/trips';
import { PassportView } from './passport-view';

export async function generateMetadata() {
  const t = await getTranslations('passportPage');
  return { title: t('title') };
}

/** The account's commemorative passport: one visa per country, stamped from the map board. */
export default async function PassportPage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const visas = cookieHeader ? await fetchVisas({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
  return <PassportView visas={visas} />;
}
