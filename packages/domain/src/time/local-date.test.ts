import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareLocalDates,
  fullMonthsBetween,
  InvalidDateError,
  isLocalDate,
  toLocalDate,
  yearMonthOf,
  type YearMonth,
} from './local-date';

const d = toLocalDate;

describe('LocalDate validation', () => {
  it.each(['2027-04-03', '2028-02-29', '2026-12-31', '0001-01-01'])('accepts %s', (v) => {
    expect(isLocalDate(v)).toBe(true);
  });

  it.each([
    '2027-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-1-1',
    '26-01-01',
    '2026-01-01T00:00',
    '',
  ])('rejects %j', (v) => {
    expect(isLocalDate(v)).toBe(false);
    expect(() => toLocalDate(v)).toThrow(InvalidDateError);
  });

  it('rejects non-strings', () => {
    expect(isLocalDate(20270403)).toBe(false);
    expect(isLocalDate(null)).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays(d('2027-04-03'), 9)).toBe('2027-04-12');
    expect(addDays(d('2026-12-30'), 3)).toBe('2027-01-02');
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(d('2027-03-01'), -1)).toBe('2027-02-28');
  });

  it('compares chronologically', () => {
    expect(compareLocalDates(d('2027-04-03'), d('2027-04-03'))).toBe(0);
    expect(compareLocalDates(d('2027-04-03'), d('2027-04-04'))).toBe(-1);
    expect(compareLocalDates(d('2028-01-01'), d('2027-12-31'))).toBe(1);
  });

  it('adds months to a year-month', () => {
    expect(yearMonthOf(d('2026-11-07'))).toBe('2026-11');
    expect(addMonths('2026-11' as YearMonth, 5)).toBe('2027-04');
    expect(addMonths('2027-01' as YearMonth, -1)).toBe('2026-12');
    expect(addMonths('2026-11' as YearMonth, 0)).toBe('2026-11');
    expect(addMonths('2026-12' as YearMonth, 13)).toBe('2028-01');
  });

  it.each([
    ['2026-11-07', '2027-04-03', 4],
    ['2026-11-07', '2027-04-07', 5],
    ['2026-11-07', '2026-11-30', 0],
    ['2026-11-07', '2026-11-07', 0],
    ['2027-04-03', '2026-11-07', 0],
    ['2027-01-31', '2027-02-28', 0],
    ['2027-01-31', '2027-03-31', 2],
  ])('fullMonthsBetween(%s, %s) = %d', (from, to, months) => {
    expect(fullMonthsBetween(d(from), d(to))).toBe(months);
  });

  const dateArb = fc
    .date({
      min: new Date('1970-01-01T00:00:00Z'),
      max: new Date('2200-12-31T00:00:00Z'),
      noInvalidDate: true,
    })
    .map((x) => d(x.toISOString().slice(0, 10)));

  it('addDays is invertible and order-preserving', () => {
    fc.assert(
      fc.property(dateArb, fc.integer({ min: -5000, max: 5000 }), (date, n) => {
        const moved = addDays(date, n);
        expect(isLocalDate(moved)).toBe(true);
        expect(addDays(moved, -n)).toBe(date);
        expect(compareLocalDates(moved, date)).toBe(Math.sign(n) || 0);
      }),
    );
  });
});
