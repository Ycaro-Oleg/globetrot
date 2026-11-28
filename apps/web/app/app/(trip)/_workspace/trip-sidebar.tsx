'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { TRIP_HOME } from '../../_components/nav-model';
import styles from './workspace.module.css';

/** A day of the trip as the sidebar lists it: "Mon 30/11" with a start date, "Day 1" without one. */
export type WorkspaceDay = {
  readonly index: number;
  readonly label: string;
  /** Where the person sleeps that day (or arrives); the map follows it. */
  readonly stopId: string | null;
};

/**
 * The trip's table of contents (from 720 px): five rows (overview, places, itinerary, budget, checklist), plain
 * links in a `nav`, so the keyboard and screen readers get the same path as a pointer. Only the itinerary has
 * children (a link into every day): they fold behind a chevron button beside its link, folded by default, and the
 * folded row still says which day is being read. "Expand map" is not a section: it sits in the drawer's footer.
 */
export function TripSidebar({
  tripTitle,
  days,
  pathname,
  activeDay,
  itineraryOpen,
  onItineraryOpen,
}: {
  tripTitle: string | null;
  days: readonly WorkspaceDay[];
  pathname: string;
  /** The day being read in the document, marked as the current location. */
  activeDay: number | null;
  /** Whether the itinerary's days are shown (remembered on the device by the workspace). */
  itineraryOpen: boolean;
  onItineraryOpen: (open: boolean) => void;
}) {
  const t = useTranslations('workspace');
  const onHome = pathname === TRIP_HOME;
  const page = (href: string) => (pathname === href ? 'page' : undefined);
  const daysId = useId();
  const reading = onHome ? (days.find((day) => day.index === activeDay) ?? null) : null;
  const foldedOnReading = !itineraryOpen && reading !== null;

  return (
    <nav className={styles.sidebar} aria-label={t('sidebarLabel')}>
      {tripTitle ? <p className={styles.sidebarTrip}>{tripTitle}</p> : null}
      <ul className={styles.sections}>
        <li>
          <Link href={TRIP_HOME} className={styles.section} aria-current={page(TRIP_HOME)}>
            {t('overview')}
          </Link>
        </li>
        <li>
          <Link href={`${TRIP_HOME}#places`} className={styles.section}>
            {t('places')}
          </Link>
        </li>
        <li>
          <div className={styles.sectionRow} data-reading={foldedOnReading ? '' : undefined}>
            <Link
              href={`${TRIP_HOME}#itinerary`}
              className={styles.section}
              aria-current={foldedOnReading ? 'location' : undefined}
              // Going to the itinerary opens its days too.
              onClick={() => onItineraryOpen(true)}
            >
              <span>{t('itinerary')}</span>
              {foldedOnReading ? <span className={styles.readingDay}>{reading.label}</span> : null}
            </Link>
            {days.length > 0 ? (
              <button
                type="button"
                className={styles.disclosure}
                aria-expanded={itineraryOpen}
                aria-controls={daysId}
                aria-label={itineraryOpen ? t('daysHide') : t('daysShow')}
                onClick={() => onItineraryOpen(!itineraryOpen)}
              >
                <span aria-hidden="true" className={styles.chevron}>
                  ›
                </span>
              </button>
            ) : null}
          </div>
          {days.length > 0 ? (
            <ul id={daysId} className={styles.sub} hidden={!itineraryOpen}>
              {days.map((day) => (
                <li key={day.index}>
                  <Link
                    href={`${TRIP_HOME}#day-${day.index}`}
                    className={styles.subLink}
                    aria-current={onHome && activeDay === day.index ? 'location' : undefined}
                  >
                    {day.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        <li>
          <Link href="/app/budget" className={styles.section} aria-current={page('/app/budget')}>
            {t('budget')}
          </Link>
        </li>
        <li>
          <Link href="/app/lists" className={styles.section} aria-current={page('/app/lists')}>
            {t('checklist')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** The drawer's footer: the full map, an action that leaves the workspace. */
export function ExpandMapLink() {
  const t = useTranslations('workspace');
  return (
    <Link href="/app/board" className={styles.mapAction}>
      <span aria-hidden="true">◎</span> {t('expandMap')}
    </Link>
  );
}

/**
 * The same sections as a row on a phone (below 720 px the sidebar is gone), with the map one tap away on the
 * floating button.
 */
export function TripJumpBar({ pathname }: { pathname: string }) {
  const t = useTranslations('workspace');
  const page = (href: string) => (pathname === href ? 'page' : undefined);
  return (
    <nav className={styles.jumpBar} aria-label={t('jumpLabel')}>
      <Link href={TRIP_HOME} className={styles.jump} aria-current={page(TRIP_HOME)}>
        {t('overview')}
      </Link>
      <Link href={`${TRIP_HOME}#itinerary`} className={styles.jump}>
        {t('itinerary')}
      </Link>
      <Link href="/app/budget" className={styles.jump} aria-current={page('/app/budget')}>
        {t('budget')}
      </Link>
      <Link href="/app/lists" className={styles.jump} aria-current={page('/app/lists')}>
        {t('checklist')}
      </Link>
    </nav>
  );
}
