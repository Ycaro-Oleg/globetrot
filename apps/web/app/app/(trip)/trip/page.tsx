import { formatLocalDate, type SupportedLocale } from '@globetrot/i18n';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { loadCurrentDestinations, loadCurrentTrip } from '../../../../lib/current-trip';
import { isPipEnabled } from '../../../../lib/flags';
import { fetchBudget } from '../../../../lib/trips';
import { DaysView } from '../../days/days-view';
import { loadDays } from '../../days/load-days';
import { TitleEditor } from '../../trips/[id]/title-editor';
import styles from './trip.module.css';

export async function generateMetadata() {
  const t = await getTranslations('workspace');
  return { title: t('metaTitle') };
}

/**
 * The trip's document (the trip workspace's overview): its name and dates, what it costs so far, its places in
 * order and, day by day, what is planned. The sidebar links into it and the map beside it follows the day being
 * read; editing the route stays on the full map.
 */
export default async function TripPage() {
  const [{ options, trip }, destinations, days, locale, t] = await Promise.all([
    loadCurrentTrip(),
    loadCurrentDestinations(),
    loadDays(),
    getLocale(),
    getTranslations('workspace'),
  ]);

  if (!trip) {
    return (
      <section className={styles.document} aria-labelledby="trip-title">
        <h1 id="trip-title" className={styles.title}>
          {t('metaTitle')}
        </h1>
        <p className={styles.muted}>{t('noTrip')}</p>
        <Link className={styles.button} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }

  const budget = options ? await fetchBudget(options, trip.id) : null;
  const canEdit = trip.role !== 'viewer';
  const dated = days.days.filter((day) => day.date !== null);
  const date = (value: string) =>
    formatLocalDate(value, locale as SupportedLocale, { day: 'numeric', month: 'short' });
  const range =
    dated.length > 0
      ? t('dates', { start: date(dated[0]!.date!), end: date(dated.at(-1)!.date!) })
      : t('noDates');
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));
  const hasCosts = budget !== null && Number(budget.total.amount) > 0;
  const countryOf = (code: string | null | undefined) => {
    if (!code) return null;
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <article className={styles.document} aria-labelledby="trip-title">
      <header className={styles.header}>
        {canEdit ? (
          <TitleEditor tripId={trip.id} title={trip.title} />
        ) : (
          <h1 id="trip-title" className={styles.title}>
            {trip.title}
          </h1>
        )}
        <p className={styles.meta}>
          <span>{range}</span>
          <Link href={`/app/trips/${trip.id}`} className={styles.link}>
            {t('settings')}
          </Link>
        </p>
      </header>

      <section className={styles.summary} aria-labelledby="trip-budget">
        <h2 id="trip-budget" className={styles.cardTitle}>
          {t('budget')}
        </h2>
        <p className={styles.amount}>
          {hasCosts ? (
            <>
              <span className={styles.amountLabel}>{t('budgetTotal')}</span>{' '}
              {money(budget.total.amount, budget.currency)}
            </>
          ) : (
            <span className={styles.muted}>{t('budgetNone')}</span>
          )}
        </p>
        <Link href="/app/budget" className={styles.link}>
          {t('budgetSee')}
        </Link>
      </section>

      <section id="places" className={styles.section} aria-labelledby="places-title">
        <div className={styles.sectionHead}>
          <h2 id="places-title" className={styles.sectionTitle}>
            {t('places')}
          </h2>
          <Link href="/app/board" className={styles.link}>
            {t('editOnMap')}
          </Link>
        </div>
        {(destinations ?? []).length === 0 ? (
          <p className={styles.muted}>{t('placesEmpty')}</p>
        ) : (
          <ol className={styles.stops}>
            {(destinations ?? []).map((stop, index) => (
              // The map knows a stop by its place key, so the pin and this row share it.
              <li key={stop.id} id={`stop-${stop.placeKey}`} tabIndex={-1} className={styles.stop}>
                <span className={styles.stopNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.stopText}>
                  <span className={styles.stopName}>{stop.name}</span>
                  <span className={styles.muted}>
                    {[countryOf(stop.countryCode), t('nights', { count: stop.nights })]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="itinerary" className={styles.section} aria-label={t('itinerary')}>
        <DaysView
          layout="stacked"
          pipEnabled={isPipEnabled()}
          trip={days.trip}
          stops={days.stops}
          days={days.days}
          places={days.places}
          ideas={days.ideas}
          mapSpots={days.mapSpots}
        />
      </section>
    </article>
  );
}
