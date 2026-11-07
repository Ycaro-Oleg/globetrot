import { describe, expect, it } from 'vitest';
import { japanDemo } from './__fixtures__/japan-demo';
import { emptyDays, plannedStops, tripDays } from './days';
import { InvalidTripError, type TripPlan } from './types';

describe('tripDays', () => {
  it('lays out the Japan demo as 10 consecutive days from 3 April 2027', () => {
    const days = tripDays(japanDemo());
    expect(days).toHaveLength(10);
    expect(days.map((d) => d.date)).toEqual([
      '2027-04-03',
      '2027-04-04',
      '2027-04-05',
      '2027-04-06',
      '2027-04-07',
      '2027-04-08',
      '2027-04-09',
      '2027-04-10',
      '2027-04-11',
      '2027-04-12',
    ]);
    expect(days.map((d) => d.stopId)).toEqual([
      'tokyo',
      'tokyo',
      'tokyo',
      'tokyo',
      'hakone',
      'kyoto',
      'kyoto',
      'kyoto',
      'osaka',
      'osaka',
    ]);
    expect(days.filter((d) => d.arrival).map((d) => d.index)).toEqual([1, 5, 6, 9]);
  });

  it('ignores draft stops and day trips add no day', () => {
    const trip: TripPlan = {
      ...japanDemo(),
      stops: [
        { id: 'a', nights: 2, state: 'planned', places: [] },
        { id: 'daytrip', nights: 0, state: 'planned', places: [] },
        { id: 'pip', nights: 3, state: 'draft', places: [] },
        { id: 'b', nights: 1, state: 'planned', places: [] },
      ],
    };
    expect(tripDays(trip).map((d) => [d.index, d.stopId])).toEqual([
      [1, 'a'],
      [2, 'a'],
      [3, 'b'],
    ]);
    expect(plannedStops(trip).map((s) => s.id)).toEqual(['a', 'daytrip', 'b']);
  });

  it('has no dates until the trip has a start date', () => {
    const days = tripDays({ ...japanDemo(), startDate: null });
    expect(days).toHaveLength(10);
    expect(days.every((d) => d.date === null)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN])('rejects invalid nights (%s)', (nights) => {
    const trip: TripPlan = {
      ...japanDemo(),
      stops: [{ id: 'x', nights, state: 'planned', places: [] }],
    };
    expect(() => tripDays(trip)).toThrow(InvalidTripError);
  });
});

describe('emptyDays', () => {
  it('finds the 3 unplanned days of the Japan demo', () => {
    expect(emptyDays(japanDemo()).map((d) => d.index)).toEqual([4, 8, 10]);
  });

  it('ignores places on draft stops', () => {
    const trip: TripPlan = {
      ...japanDemo(),
      stops: [
        { id: 'a', nights: 1, state: 'planned', places: [] },
        { id: 'pip', nights: 1, state: 'draft', places: [{ id: 'p', day: 1, done: false }] },
      ],
    };
    expect(emptyDays(trip).map((d) => d.index)).toEqual([1]);
  });
});
