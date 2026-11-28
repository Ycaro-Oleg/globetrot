'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { TRIP_HOME } from '../../_components/nav-model';
import styles from './workspace.module.css';

/** A day of the trip as the sidebar lists it: "Mon 30/11" with a start date, "Day 1" without one. */
export type WorkspaceDay = {
  readonly index: number;
  readonly label: string;
  /** Where the person sleeps that day (or arrives); the map follows it. */
  readonly stopId: string | null;
};

/** From this many days on, the itinerary's days start folded, so the budget and the checklist stay in view. */
export const LONG_TRIP_DAYS = 8;

/**
 * The trip's table of contents (from 720 px): the overview, its places and every day of the itinerary (links into
 * the trip's document), then the budget and the checklists, with the full map as a button under them. Plain links
 * in a `nav`, so the keyboard and screen readers get the same path as a pointer. A long trip's days fold behind a
 * disclosure button next to "Itinerary".
 */
export function TripSidebar({
  tripTitle,
  days,
  pathname,
  activeDay,
}: {
  tripTitle: string | null;
  days: readonly WorkspaceDay[];
  pathname: string;
  /** The day being read in the document, marked as the current location. */
  activeDay: number | null;
}) {
  const t = useTranslations('workspace');
  const onHome = pathname === TRIP_HOME;
  const page = (href: string) => (pathname === href ? 'page' : undefined);
  const daysId = useId();
  const [daysOpen, setDaysOpen] = useState(days.length < LONG_TRIP_DAYS);

  return (
    <nav className={styles.sidebar} aria-label={t('sidebarLabel')}>
      {tripTitle ? <p className={styles.sidebarTrip}>{tripTitle}</p> : null}
      <ul className={styles.sections}>
        <li>
          <Link href={TRIP_HOME} className={styles.section} aria-current={page(TRIP_HOME)}>
            {t('overview')}
          </Link>
          <ul className={styles.sub}>
            <li>
              <Link href={`${TRIP_HOME}#places`} className={styles.subLink}>
                {t('places')}
              </Link>
            </li>
          </ul>
        </li>
        <li>
          <div className={styles.sectionRow}>
            <Link href={`${TRIP_HOME}#itinerary`} className={styles.section}>
              {t('itinerary')}
            </Link>
            {days.length > 0 ? (
              <button
                type="button"
                className={styles.disclosure}
                aria-expanded={daysOpen}
                aria-controls={daysId}
                aria-label={daysOpen ? t('daysHide') : t('daysShow', { count: days.length })}
                onClick={() => setDaysOpen((open) => !open)}
              >
                <span aria-hidden="true">{daysOpen ? '▾' : '▸'}</span>
              </button>
            ) : null}
          </div>
          {days.length > 0 ? (
            <ul id={daysId} className={styles.sub} hidden={!daysOpen}>
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
      <Link href="/app/board" className={styles.mapAction}>
        <span aria-hidden="true">⤢</span> {t('expandMap')}
      </Link>
    </nav>
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
