import { describe, expect, it } from 'vitest';
import {
  arcBetween,
  distanceKm,
  moveStop,
  partialLine,
  routeBody,
  stopDays,
  toDestination,
  zoomLevel,
  type RouteStop,
} from './board-route';

const stop = (id: string, extra: Partial<RouteStop> = {}): RouteStop => ({
  id,
  name: id,
  countryCode: 'JP',
  region: '',
  latitude: 35,
  longitude: 135,
  nights: 1,
  note: '',
  legMode: null,
  visited: false,
  spots: [],
  todos: [],
  ...extra,
});

describe('board route', () => {
  it('moves a stop up and down, clamped to the ends', () => {
    expect(moveStop(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveStop(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveStop(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveStop(['a', 'b', 'c'], 2, 9)).toEqual(['a', 'b', 'c']);
  });

  it('sends the note trimmed, blank as null, and no leg on the last stop', () => {
    expect(
      toDestination(stop('tokyo', { note: '  ramen ', legMode: 'train' }), false),
    ).toMatchObject({ note: 'ramen', legMode: 'train' });
    expect(toDestination(stop('kyoto', { note: '   ', legMode: 'train' }), true)).toMatchObject({
      note: null,
      legMode: null,
    });
    const body = JSON.parse(
      routeBody([stop('a', { legMode: 'bus' }), stop('b', { legMode: 'bus' })]),
    );
    expect(body.map((d: { legMode: string | null }) => d.legMode)).toEqual(['bus', null]);
  });

  it('sends visited, and spots and todos trimmed without blank ones', () => {
    expect(
      toDestination(
        stop('kyoto', {
          visited: true,
          spots: [
            { name: ' Gion ', latitude: null, longitude: null, done: false },
            { name: '  ', latitude: null, longitude: null, done: false },
          ],
          todos: [{ text: ' Book ryokan ', done: true }],
        }),
        true,
      ),
    ).toMatchObject({
      visited: true,
      spots: [{ name: 'Gion', latitude: null, longitude: null, done: false }],
      todos: [{ text: 'Book ryokan', done: true }],
    });
  });

  it('measures distance as the crow flies', () => {
    const tokyo = { latitude: 35.6812, longitude: 139.7671 };
    const kyoto = { latitude: 34.9858, longitude: 135.7588 };
    expect(Math.round(distanceKm(tokyo, kyoto))).toBeGreaterThan(360);
    expect(Math.round(distanceKm(tokyo, kyoto))).toBeLessThan(380);
    expect(distanceKm(tokyo, tokyo)).toBe(0);
  });

  it('draws an arc that starts and ends on the stops, and cuts it for the draw-in', () => {
    const a = { latitude: 35, longitude: 135 };
    const b = { latitude: 35, longitude: 140 };
    const arc = arcBetween(a, b, 10);
    expect(arc).toHaveLength(11);
    expect(arc[0]![0]).toBeCloseTo(135, 6);
    expect(arc[10]![0]).toBeCloseTo(140, 6);
    expect(arc[0]![1]).toBeCloseTo(35, 6);
    // it bows north (up on the map) between two places on the same latitude
    expect(arc[5]![1]).toBeGreaterThan(35);
    expect(partialLine(arc, 0)).toHaveLength(2);
    expect(partialLine(arc, 1)).toHaveLength(11);
    expect(partialLine(arc, 0.5).at(-1)).toEqual(arc[5]);
  });

  it('names the zoom level and counts the days of each stop from the start date', () => {
    expect([1, 4, 8, 12, 16].map(zoomLevel)).toEqual([0, 1, 2, 3, 4]);
    const route = [stop('a', { nights: 4 }), stop('b', { nights: 2 })];
    const days = stopDays(route, 1, '2027-04-03');
    expect(days?.start.toISOString().slice(0, 10)).toBe('2027-04-07');
    expect(days?.end.toISOString().slice(0, 10)).toBe('2027-04-09');
    expect(stopDays(route, 0, null)).toBeNull();
  });
});
