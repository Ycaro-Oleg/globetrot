import { addDays, type LocalDate } from '../time/local-date';

/**
 * A trip as an iCalendar file (RFC 5545): one all-day event per day of the trip, named after the day, the stop and
 * the trip, with the places planned that day in the description. Pure text in, text out: the words come from the
 * caller (already in the person's language), so this module stays free of copy.
 */
export interface CalendarDay {
  readonly index: number;
  readonly date: LocalDate;
  readonly summary: string;
  /** Lines for the description, e.g. "Belém Tower · 1 h". */
  readonly lines: readonly string[];
}

const CRLF = '\r\n';

/** Escapes text values (backslash, semicolon, comma, new lines). */
export function escapeCalendarText(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets, continuing with a space (multi-byte characters are never split). */
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const compact = (date: LocalDate) => date.replaceAll('-', '');

export function tripCalendar(input: {
  /** Stable across exports, so importing again updates the same events. */
  readonly tripId: string;
  readonly calendarName: string;
  readonly days: readonly CalendarDay[];
  /** When the file was made, for DTSTAMP. */
  readonly now: Date;
}): string {
  const stamp = input.now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Globetrot//Trip//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeCalendarText(input.calendarName)}`,
  ];
  for (const day of input.days) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${input.tripId}-day-${day.index}@globetrot`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(day.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(day.date, 1))}`,
      `SUMMARY:${escapeCalendarText(day.summary)}`,
      ...(day.lines.length > 0 ? [`DESCRIPTION:${escapeCalendarText(day.lines.join('\n'))}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join(CRLF) + CRLF;
}
