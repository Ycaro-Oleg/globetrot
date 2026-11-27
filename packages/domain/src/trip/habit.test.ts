import { describe, expect, it } from 'vitest';
import { toLocalDate } from '../time/local-date';
import { addWeeks, checkinStreak, isIsoWeek, isoWeekOf, type IsoWeek } from './habit';
import { tripCountdown } from './timeline';

const d = (value: string) => toLocalDate(value);
const w = (value: string) => value as IsoWeek;

describe('ISO weeks', () => {
  it('follow ISO 8601, including the weeks that cross a year', () => {
    expect(isoWeekOf(d('2026-11-27'))).toBe('2026-W48');
    expect(isoWeekOf(d('2027-01-01'))).toBe('2026-W53');
    expect(isoWeekOf(d('2027-01-04'))).toBe('2027-W01');
    expect(isoWeekOf(d('2024-12-30'))).toBe('2025-W01');
    expect(addWeeks(w('2027-W01'), -1)).toBe('2026-W53');
    expect(addWeeks(w('2026-W48'), 6)).toBe('2027-W01');
    expect(isIsoWeek('2027-W05')).toBe(true);
    expect(isIsoWeek('2027-W60')).toBe(false);
  });
});

describe('checkinStreak', () => {
  it('counts weeks in a row ending this week, or last week while this one is still to come', () => {
    const weeks = [w('2026-W45'), w('2026-W46'), w('2026-W47')];
    expect(checkinStreak(weeks, w('2026-W48'))).toBe(3);
    expect(checkinStreak([...weeks, w('2026-W48')], w('2026-W48'))).toBe(4);
    expect(checkinStreak(weeks, w('2026-W49'))).toBe(0);
    expect(checkinStreak([w('2026-W53'), w('2027-W01')], w('2027-W01'))).toBe(2);
  });
});

describe('tripCountdown', () => {
  it('moves through the phases as departure gets closer, then travelling and back', () => {
    const start = d('2027-06-10');
    expect(tripCountdown(null, 5, d('2027-01-01')).phase).toBeNull();
    expect(tripCountdown(start, 7, d('2026-12-01'))).toMatchObject({ phase: 'six-months' });
    expect(tripCountdown(start, 7, d('2027-04-01')).phase).toBe('three-months');
    expect(tripCountdown(start, 7, d('2027-05-20')).phase).toBe('one-month');
    expect(tripCountdown(start, 7, d('2027-06-05'))).toMatchObject({
      phase: 'one-week',
      daysLeft: 5,
    });
    expect(tripCountdown(start, 7, d('2027-06-10'))).toMatchObject({
      phase: 'travelling',
      daysLeft: 0,
    });
    expect(tripCountdown(start, 7, d('2027-06-15')).phase).toBe('travelling');
    expect(tripCountdown(start, 7, d('2027-06-20')).phase).toBe('back');
  });
});

describe('localDateIn', () => {
  it('reads the day in the person’s time zone, or UTC without a valid one', async () => {
    const { localDateIn } = await import('../time/local-date');
    const lateUtc = new Date('2026-11-29T01:30:00.000Z');
    expect(localDateIn(lateUtc, 'America/Sao_Paulo')).toBe('2026-11-28');
    expect(localDateIn(lateUtc, 'Asia/Tokyo')).toBe('2026-11-29');
    expect(localDateIn(lateUtc, null)).toBe('2026-11-29');
    expect(localDateIn(lateUtc, 'Not/AZone')).toBe('2026-11-29');
  });
});
