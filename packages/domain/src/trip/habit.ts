/**
 * The saving habit (ADR-0026): a weekly check-in ("I set this aside this week") and how many weeks in a row it
 * was kept. Weeks are ISO 8601 weeks (Monday to Sunday), written `YYYY-Www`, in the person's own calendar.
 */
import type { LocalDate } from '../time/local-date';

/** An ISO week, `2027-W05`. */
export type IsoWeek = string & { readonly __brand: 'IsoWeek' };

const DAY_MS = 86_400_000;

function utc(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** The ISO week a calendar day belongs to (the week's Thursday decides the year). */
export function isoWeekOf(date: LocalDate): IsoWeek {
  const day = utc(date);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  const thursday = new Date(day.getTime() + (3 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  const week1Monday = firstThursday.getTime() - firstWeekday * DAY_MS;
  const week = Math.floor((thursday.getTime() - week1Monday) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}` as IsoWeek;
}

/** The ISO week `weeks` before (negative) or after `week`. */
export function addWeeks(week: IsoWeek, weeks: number): IsoWeek {
  const [year, number] = week.split('-W').map(Number) as [number, number];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS + (number - 1) * 7 * DAY_MS;
  const target = new Date(monday + weeks * 7 * DAY_MS).toISOString().slice(0, 10) as LocalDate;
  return isoWeekOf(target);
}

export function isIsoWeek(value: unknown): value is IsoWeek {
  return typeof value === 'string' && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value);
}

/**
 * Weeks in a row with a check-in, ending this week, or last week while this week's is still to come (so the
 * streak does not look broken on a Monday morning).
 */
export function checkinStreak(weeks: readonly IsoWeek[], thisWeek: IsoWeek): number {
  const done = new Set(weeks);
  let cursor = done.has(thisWeek) ? thisWeek : addWeeks(thisWeek, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}
