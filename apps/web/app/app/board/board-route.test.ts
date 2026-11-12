import { describe, expect, it } from 'vitest';
import { legsOf, moveStop, routeBody, toDestination, type RouteStop } from './board-route';

const stop = (id: string, extra: Partial<RouteStop> = {}): RouteStop => ({
  id,
  name: id,
  country: '',
  countryCode: 'JP',
  region: '',
  latitude: 35,
  longitude: 135,
  nights: 1,
  note: '',
  legMode: null,
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
    ).toMatchObject({
      note: 'ramen',
      legMode: 'train',
    });
    expect(toDestination(stop('kyoto', { note: '   ', legMode: 'train' }), true)).toMatchObject({
      note: null,
      legMode: null,
    });
    const body = JSON.parse(
      routeBody([stop('a', { legMode: 'bus' }), stop('b', { legMode: 'bus' })]),
    );
    expect(body.map((d: { legMode: string | null }) => d.legMode)).toEqual(['bus', null]);
  });

  it('lists the legs between consecutive stops with their mode', () => {
    const legs = legsOf([stop('a', { legMode: 'flight' }), stop('b'), stop('c')]);
    expect(legs.map((leg) => [leg.from.id, leg.to.id, leg.mode])).toEqual([
      ['a', 'b', 'flight'],
      ['b', 'c', null],
    ]);
    expect(legsOf([stop('a')])).toEqual([]);
  });
});
