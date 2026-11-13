import { tripDays, toLocalDate } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import { buildBoard, dropTarget, type BoardStop } from './day-board';

const stops: BoardStop[] = [
  { id: 'tyo', name: 'Tokyo', nights: 2, legMode: 'train' },
  { id: 'kyo', name: 'Kyoto', nights: 1, legMode: null },
];
const days = tripDays({
  startDate: toLocalDate('2027-04-03'),
  stops: stops.map((stop) => ({ id: stop.id, nights: stop.nights, state: 'planned', places: [] })),
});
const place = (id: string, minutes: number, day: number | null, destinationId = 'tyo') => ({
  id,
  name: id,
  minutes,
  day,
  destinationId,
});

describe('buildBoard', () => {
  it('puts places without a day, or past the route, on "No day"', () => {
    const board = buildBoard(days, stops, [
      place('a', 60, null),
      place('b', 60, 9),
      place('c', 60, 1),
    ]);
    expect(board.tray.map((p) => p.id)).toEqual(['a', 'b']);
    expect(board.days[0]?.places.map((p) => p.id)).toEqual(['c']);
  });

  it('adds up the hours of each day and names full and light days', () => {
    const board = buildBoard(days, stops, [
      place('a', 300, 1),
      place('b', 300, 1),
      place('c', 240, 2),
      place('d', 60, 3, 'kyo'),
    ]);
    expect(board.days.map((day) => [day.hours, day.load])).toEqual([
      [10, 'full'],
      [4, 'ok'],
      [1, 'light'],
    ]);
    expect(board.fullDays).toBe(1);
    expect(board.totalHours).toBe(15);
  });

  it('shows the move from the previous stop on the first day at the next one', () => {
    const board = buildBoard(days, stops, []);
    expect(board.days.map((day) => day.travel)).toEqual([
      null,
      null,
      { mode: 'train', from: 'Tokyo', to: 'Kyoto' },
    ]);
  });
});

describe('dropTarget', () => {
  it('drops before the card it lands on, or at the end of the day', () => {
    expect(dropTarget('a', { day: 2, beforeId: 'b' })).toEqual({ day: 2, beforeId: 'b' });
    expect(dropTarget('a', { day: null })).toEqual({ day: null });
    expect(dropTarget('a', { day: 2, beforeId: 'a' })).toBeNull();
  });
});
