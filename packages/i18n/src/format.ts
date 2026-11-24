import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import { messageShape } from './ast';
import { catalogs, lookupMessage, type MessageKey } from './catalog';
import type { SupportedLocale } from './locales';

export type MessageValues = Record<string, PrimitiveType>;

export class MissingMessageError extends Error {
  constructor(
    readonly locale: string,
    readonly key: string,
  ) {
    super(`Missing message "${key}" for locale ${locale}`);
    this.name = 'MissingMessageError';
  }
}

interface CompiledMessage {
  readonly formatter: IntlMessageFormat;
  /** Renders rich-text tags as plain text (keeps the content, drops the tag). */
  readonly plainTags: Record<string, (chunks: unknown[]) => string>;
}

const cache = new Map<string, CompiledMessage>();

function compile(locale: SupportedLocale, key: MessageKey): CompiledMessage {
  const cacheKey = `${locale}|${key}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const message = lookupMessage(catalogs[locale], key);
  if (message === undefined) throw new MissingMessageError(locale, key);
  const plainTags = Object.fromEntries(
    [...messageShape(message).tags].map((tag) => [tag, (chunks: unknown[]) => chunks.join('')]),
  );
  const compiled = { formatter: new IntlMessageFormat(message, locale), plainTags };
  cache.set(cacheKey, compiled);
  return compiled;
}

/**
 * Formats a catalog message outside React (emails, notifications, worker, API errors).
 * The web app uses next-intl with the same catalogs. Rich-text tags (`<strong>…</strong>`)
 * are rendered as plain text here.
 */
export function formatMessage(
  locale: SupportedLocale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  const { formatter, plainTags } = compile(locale, key);
  const result = formatter.format({ ...plainTags, ...values });
  return Array.isArray(result) ? result.join('') : String(result);
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/**
 * Formats a time-zone-free calendar date ("2027-04-03") for a locale.
 * Formatting happens in UTC, so the printed day never shifts with the viewer's time zone.
 */
export function formatLocalDate(
  date: string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (!LOCAL_DATE.test(date)) throw new RangeError(`Not a YYYY-MM-DD date: "${date}"`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utcDate(y, m, d));
}

/** Formats a calendar month ("2027-04") as "April 2027" or "abril de 2027". */
export function formatYearMonth(month: string, locale: SupportedLocale): string {
  if (!YEAR_MONTH.test(month)) throw new RangeError(`Not a YYYY-MM month: "${month}"`);
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate(y, m, 1));
}
