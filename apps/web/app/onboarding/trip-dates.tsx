'use client';

import { getLocalTimeZone, parseDate, today } from '@internationalized/date';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  I18nProvider,
  RangeCalendar,
} from 'react-aria-components';
import styles from './onboarding.module.css';

export interface TripRange {
  /** `YYYY-MM-DD`: the day the trip starts. */
  readonly start: string;
  /** `YYYY-MM-DD`: the day the person comes back. */
  readonly end: string;
}

export const nightsOf = (range: TripRange | null) =>
  range
    ? Math.round(
        (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) /
          86_400_000,
      )
    : 0;

/**
 * The trip's dates, picked like on a travel site: a calendar (two months side by side on a wide screen), tap the
 * day you leave and the day you come back. Keyboard: arrows move, Enter picks (React Aria's range calendar).
 */
export function TripDates({
  value,
  onChange,
}: {
  value: TripRange | null;
  onChange: (range: TripRange) => void;
}) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 860px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const months = wide ? 2 : 1;
  const nights = nightsOf(value);
  const day = (iso: string) => {
    const text = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
    // "seg., 14 de dez." → "Seg., 14 de dez.": only the first letter.
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  };

  return (
    <div className={styles.dates}>
      <I18nProvider locale={locale}>
        <RangeCalendar
          aria-label={t('datesLabel')}
          className={styles.calendar ?? ''}
          minValue={today(getLocalTimeZone())}
          visibleDuration={{ months }}
          value={value ? { start: parseDate(value.start), end: parseDate(value.end) } : null}
          onChange={(range) =>
            onChange({ start: range.start.toString(), end: range.end.toString() })
          }
        >
          <header className={styles.calendarHead ?? ''}>
            <Button slot="previous" className={styles.calendarNav ?? ''}>
              ‹
            </Button>
            <Heading className={styles.calendarTitle ?? ''} />
            <Button slot="next" className={styles.calendarNav ?? ''}>
              ›
            </Button>
          </header>
          <div className={styles.calendarMonths ?? ''}>
            {Array.from({ length: months }, (_, offset) => (
              <CalendarGrid
                key={offset}
                offset={{ months: offset }}
                className={styles.calendarGrid ?? ''}
              >
                <CalendarGridHeader>
                  {(name) => <CalendarHeaderCell>{name}</CalendarHeaderCell>}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => <CalendarCell date={date} className={styles.calendarCell ?? ''} />}
                </CalendarGridBody>
              </CalendarGrid>
            ))}
          </div>
        </RangeCalendar>
      </I18nProvider>
      <p className={styles.datesSummary} aria-live="polite">
        {value ? (
          <>
            <strong>{day(value.start)}</strong>
            <span aria-hidden="true"> → </span>
            <strong>{day(value.end)}</strong>
            <span> · {t('nightsValue', { count: nights })}</span>
          </>
        ) : (
          t('datesHint')
        )}
      </p>
    </div>
  );
}
