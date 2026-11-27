import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TripView } from '../../../lib/trips';
import { openTrip } from '../trips/actions';
import { tripCode } from './nav-model';
import styles from './shell.module.css';

/**
 * The trip switcher pill (design handoff v2): the trip's disc, its name and a caret. A disclosure that works
 * without a script; each trip is a small form that makes it the current one. The name is drawn only from
 * 1100 px but always stays in the accessible name.
 */
export function TripSwitcher({
  trips,
  activeTripId,
}: {
  trips: readonly TripView[];
  activeTripId: string | null;
}) {
  const t = useTranslations('tripWorkspace');
  const tm = useTranslations('tripMembers');
  const activeTrip = trips.find((trip) => trip.id === activeTripId);
  const title = activeTrip?.title ?? t('switcher.noTrip');

  return (
    <details className={styles.tripSwitcher}>
      <summary className={styles.tripPill} data-active={activeTrip ? '' : undefined}>
        <span className={styles.tripDisc} aria-hidden="true">
          {activeTrip ? tripCode(activeTrip.title) : '+'}
        </span>
        <span className="sr-only">{t('switcher.label')}: </span>
        <span className={styles.tripName}>{title}</span>
        <span className={styles.caret} aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className={styles.menu} data-align="start">
        {trips.length ? (
          trips.map((trip) => {
            const current = trip.id === activeTripId;
            return (
              <form action={openTrip} key={trip.id}>
                <button
                  className={styles.tripOption}
                  type="submit"
                  name="tripId"
                  value={trip.id}
                  aria-current={current ? 'page' : undefined}
                >
                  <span
                    className={styles.tripDisc}
                    data-muted={current ? undefined : ''}
                    aria-hidden="true"
                  >
                    {tripCode(trip.title)}
                  </span>
                  <span className={styles.tripOptionText}>
                    <strong>{trip.title}</strong>
                    <span>
                      {t(`status.${trip.status}`)}
                      {trip.role === 'owner' ? null : ` · ${tm('shared')}`}
                    </span>
                  </span>
                  {current ? (
                    <span className={styles.check} aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              </form>
            );
          })
        ) : (
          <p className={styles.menuNote}>{t('switcher.empty')}</p>
        )}
        <span className={styles.menuRule} aria-hidden="true" />
        {activeTrip ? (
          <>
            <Link className={styles.menuAction} href="/app/today">
              {t('switcher.today')}
            </Link>
            <Link className={styles.menuAction} href={`/app/trips/${activeTrip.id}`}>
              {t('switcher.details')}
            </Link>
          </>
        ) : null}
        <Link className={styles.menuAction} href="/app/trips">
          {t('switcher.manage')}
        </Link>
      </div>
    </details>
  );
}
