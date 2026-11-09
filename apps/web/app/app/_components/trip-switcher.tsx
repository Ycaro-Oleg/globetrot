import Link from 'next/link';
import { Plane } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TripView } from '../../../lib/trips';
import { openTrip } from '../trips/actions';
import styles from './shell.module.css';

export function TripSwitcher({
  trips,
  activeTripId,
}: {
  trips: readonly TripView[];
  activeTripId: string | null;
}) {
  const t = useTranslations('tripWorkspace');
  const activeTrip = trips.find((trip) => trip.id === activeTripId);

  return (
    <details className={styles.tripSwitcher}>
      {/* No aria-label: the visible words ("Trip" and its name) are the accessible name (label-in-name). */}
      <summary className={styles.tripSwitcherSummary}>
        <span className={styles.tripSwitcherGlyph}>
          <Plane aria-hidden="true" size={18} />
        </span>
        <span className={styles.tripSwitcherCopy}>
          <span className={styles.tripSwitcherLabel}>{t('switcher.label')}</span>
          <strong className={styles.tripSwitcherName}>
            {activeTrip?.title ?? t('switcher.noTrip')}
          </strong>
        </span>
        <span className={styles.tripSwitcherCaret} aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className={styles.tripSwitcherPanel}>
        {trips.length ? (
          trips.map((trip) => (
            <form action={openTrip} key={trip.id}>
              <button
                className={styles.tripSwitcherOption}
                type="submit"
                name="tripId"
                value={trip.id}
                aria-current={trip.id === activeTripId ? 'page' : undefined}
              >
                <span>{trip.title}</span>
                <span>{t(`status.${trip.status}`)}</span>
              </button>
            </form>
          ))
        ) : (
          <p className={styles.tripSwitcherEmpty}>{t('switcher.empty')}</p>
        )}
        <Link className={styles.tripSwitcherManage} href="/app/trips">
          {t('switcher.manage')}
        </Link>
      </div>
    </details>
  );
}
