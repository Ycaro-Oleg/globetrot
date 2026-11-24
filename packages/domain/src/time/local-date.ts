/**
 * Calendar dates without a time zone ("2027-04-03"), as used for trip and itinerary dates
 * (docs/architecture/i18n.md). Arithmetic runs on UTC midnights, so no time zone or DST can shift a day.
 */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

/** A calendar month ("2027-04"), e.g. the month a savings goal is reached. */
export type YearMonth = string & { readonly __brand: 'YearMonth' };

export class InvalidDateError extends Error {
  constructor(readonly value: string) {
    super(`Not a valid calendar date (YYYY-MM-DD): "${value}"`);
    this.name = 'InvalidDateError';
  }
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** UTC midnight of a calendar date. `setUTCFullYear` avoids `Date.UTC` mapping years 0–99 to 1900–1999. */
function utcMidnight(y: number, m: number, d: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  return date;
}

function toUtcMs(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return utcMidnight(y, m, d).getTime();
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10) as LocalDate;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const probe = utcMidnight(y, m, d);
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Validates "YYYY-MM-DD" (real calendar dates only, e.g. no 2026-02-30). Throws `InvalidDateError`. */
export function toLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new InvalidDateError(value);
  return value;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** −1, 0 or 1 (ISO strings sort chronologically). */
export function compareLocalDates(a: LocalDate, b: LocalDate): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function yearMonthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function addMonths(month: YearMonth, months: number): YearMonth {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}` as YearMonth;
}

/**
 * Whole calendar months from `from` to `to`, counting a month only once its day-of-month is reached
 * (7 Nov 2026 → 3 Apr 2027 is 4). Returns 0 when `to` is not after `from`.
 */
export function fullMonthsBetween(from: LocalDate, to: LocalDate): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  return Math.max(0, months);
}
