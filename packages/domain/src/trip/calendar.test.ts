import { describe, expect, it } from 'vitest';
import { toLocalDate } from '../time/local-date';
import { escapeCalendarText, foldCalendarLine, tripCalendar } from './calendar';

describe('trip calendar', () => {
  const file = tripCalendar({
    tripId: 'trip-1',
    calendarName: 'Portugal, 2027',
    now: new Date('2026-11-14T12:00:00.000Z'),
    days: [
      {
        index: 1,
        date: toLocalDate('2027-03-01'),
        summary: 'Day 1 · Lisbon — Portugal',
        lines: ['Belém Tower · 1 h', 'Alfama · 2 h'],
      },
      {
        index: 2,
        date: toLocalDate('2027-03-31'),
        summary: 'Day 2 · Lisbon — Portugal',
        lines: [],
      },
    ],
  });

  it('writes one all-day event per day with a stable id, CRLF line ends', () => {
    expect(file.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(file.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(file).toContain('UID:trip-1-day-1@globetrot');
    expect(file).toContain('DTSTART;VALUE=DATE:20270301\r\nDTEND;VALUE=DATE:20270302');
    expect(file).toContain('DTSTART;VALUE=DATE:20270331\r\nDTEND;VALUE=DATE:20270401');
    expect(file).toContain('DTSTAMP:20261114T120000Z');
    expect(file).toContain('X-WR-CALNAME:Portugal\\, 2027');
    expect(file).toContain('DESCRIPTION:Belém Tower · 1 h\\nAlfama · 2 h');
    expect(file.split('BEGIN:VEVENT')[2]).not.toContain('DESCRIPTION');
  });

  it('escapes text and folds long lines at 75 octets without splitting characters', () => {
    expect(escapeCalendarText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const long = `SUMMARY:${'ã'.repeat(60)}`;
    const folded = foldCalendarLine(long);
    const encoder = new TextEncoder();
    for (const part of folded.split('\r\n'))
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replaceAll('\r\n ', '')).toBe(long);
  });
});
