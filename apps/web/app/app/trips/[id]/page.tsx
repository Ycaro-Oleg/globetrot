import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../../lib/api-proxy';
import { fetchTrip } from '../../../../lib/trips';
import { sessionCookieHeader } from '../../../../lib/stored-preferences';
import styles from '../trips.module.css';

function dateLabel(date: string | null, locale: string, notSet: string) {
  return date
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(`${date}T12:00:00Z`),
      )
    : notSet;
}

export async function generateMetadata() {
  const t = await getTranslations('tripWorkspace');
  return { title: t('overviewTitle') };
}

export default async function TripOverview({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, t, store] = await Promise.all([
    params,
    getLocale(),
    getTranslations('tripWorkspace'),
    cookies(),
  ]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const trip = cookieHeader
    ? await fetchTrip({ cookieHeader, apiUrl: apiInternalUrl() }, id)
    : null;

  if (!trip) {
    return (
      <section className={styles.page}>
        <h1>{t('notFoundTitle')}</h1>
        <p>{t('notFound')}</p>
        <Link className={styles.primaryAction} href="/app/trips">
          {t('backToTrips')}
        </Link>
      </section>
    );
  }

  const currencyName = new Intl.DisplayNames([locale], { type: 'currency' }).of(trip.currency);
  return (
    <section className={styles.page}>
      <Link href="/app/trips" className={styles.backLink}>
        {t('backToTrips')}
      </Link>
      <p className={styles.eyebrow}>{t('overviewEyebrow')}</p>
      <h1>{trip.title}</h1>
      <p className={styles.description}>{t('overviewDescription')}</p>
      <dl className={styles.details}>
        <div>
          <dt>{t('statusLabel')}</dt>
          <dd>
            <span aria-hidden="true">◇</span> {t(`status.${trip.status}`)}
          </dd>
        </div>
        <div>
          <dt>{t('startDate')}</dt>
          <dd>{dateLabel(trip.startDate, locale, t('dateNotSet'))}</dd>
        </div>
        <div>
          <dt>{t('currency')}</dt>
          <dd>
            {trip.currency}
            {currencyName ? ` · ${currencyName}` : ''}
          </dd>
        </div>
      </dl>
      <p className={styles.banner} role="status">
        {t('boardAvailable')}
      </p>
      <Link className={styles.primaryAction} href="/app/board">
        {t('openMap')}
      </Link>
    </section>
  );
}
