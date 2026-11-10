import type { TripDay } from '@globetrot/domain';
import { formatLocalDate, type SupportedLocale } from '@globetrot/i18n';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import styles from './days.module.css';

export interface DaysStop {
  readonly id: string;
  readonly name: string;
  readonly nights: number;
}

/**
 * The days of the current trip, derived (never stored) from its start date and the nights at each stop. One day per
 * night; a day trip adds none. Without a start date the days are numbered only.
 */
export function DaysView({
  trip,
  stops,
  days,
  startDate,
}: {
  trip: { readonly title: string } | null;
  stops: readonly DaysStop[];
  days: readonly TripDay[];
  startDate: string | null;
}) {
  const t = useTranslations('daysPage');
  const locale = useLocale() as SupportedLocale;

  if (trip === null) {
    return (
      <section className={styles.page}>
        <h1>{t('title')}</h1>
        <p className={styles.lead}>{t('noTrip')}</p>
        <Link className={styles.action} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }

  const total = days.length;
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{trip.title}</p>
      <h1>{t('title')}</h1>
      <p className={styles.lead}>
        {total > 0
          ? t('summary', { count: total })
          : stops.length === 0
            ? t('noStops')
            : t('noNights')}
      </p>
      <p className={styles.note}>
        {startDate
          ? t('starts', { date: formatLocalDate(startDate, locale, { dateStyle: 'long' }) })
          : t('noStartDate')}
      </p>
      {total === 0 ? (
        <Link className={styles.action} href="/app/board">
          {t('goBoard')}
        </Link>
      ) : (
        <ol className={styles.stops}>
          {stops
            .filter((stop) => stop.nights > 0)
            .map((stop) => (
              <li key={stop.id} className={styles.stop}>
                <h2>
                  {stop.name} <span>{t('nights', { count: stop.nights })}</span>
                </h2>
                <ol className={styles.days}>
                  {days
                    .filter((day) => day.stopId === stop.id)
                    .map((day) => (
                      <li key={day.index}>
                        <b>{t('day', { index: day.index })}</b>
                        {day.date ? (
                          <span>
                            {formatLocalDate(day.date, locale, {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        ) : null}
                        {day.arrival ? <em>{t('arrival')}</em> : null}
                      </li>
                    ))}
                </ol>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
