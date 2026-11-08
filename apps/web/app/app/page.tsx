import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../lib/api-proxy';
import { fetchCurrentUser } from '../../lib/current-user';
import { sessionCookieHeader } from '../../lib/stored-preferences';
import { SITE_NAME } from '../site';
import styles from './_components/shell.module.css';

export const metadata = { title: SITE_NAME };

/**
 * Placeholder for the signed-in home: the trip list and the rest arrive with later issues. The shell around it
 * (navigation, account menu) comes from the layout.
 */
export default async function AppHome() {
  const [t, store] = await Promise.all([getTranslations('app'), cookies()]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const user = cookieHeader
    ? await fetchCurrentUser({ cookieHeader, apiUrl: apiInternalUrl() })
    : null;

  return (
    <section className={styles.card}>
      <h1 className={styles.pageTitle}>{t('welcome', { name: user?.name ?? '' })}</h1>
      <p className={styles.lead}>{t('description')}</p>
    </section>
  );
}
