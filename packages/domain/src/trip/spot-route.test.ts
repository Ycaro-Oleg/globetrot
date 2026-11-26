import { describe, expect, it } from 'vitest';
import { shortestSpotOrder, spotLegs } from './spot-route';

const at = (name: string, latitude: number | null, longitude: number | null, kind?: 'stay') => ({
  name,
  latitude,
  longitude,
  ...(kind ? { kind } : {}),
});

describe('spot route', () => {
  it('measures the legs between the spots that have a place, in their order', () => {
    const { legs, totalKm } = spotLegs([
      at('A', 35.0, 135.0),
      at('no place', null, null),
      at('B', 35.0, 135.01),
      at('C', 35.01, 135.01),
    ]);
    expect(legs.map((leg) => `${leg.from.name}>${leg.to.name}`)).toEqual(['A>B', 'B>C']);
    expect(legs[0]!.km).toBeGreaterThan(0.85);
    expect(legs[0]!.km).toBeLessThan(0.95);
    expect(totalKm).toBeCloseTo(legs[0]!.km + legs[1]!.km, 6);
    expect(spotLegs([at('alone', 1, 1)]).legs).toEqual([]);
  });

  it('starts where the person sleeps and always goes to the nearest spot next', () => {
    const order = shortestSpotOrder([
      at('far', 35.1, 135.1),
      at('near', 35.001, 135.001),
      at('no place', null, null),
      at('hotel', 35.0, 135.0, 'stay'),
      at('middle', 35.05, 135.05),
    ]);
    expect(order.map((spot) => spot.name)).toEqual(['hotel', 'near', 'middle', 'far', 'no place']);
  });

  it('starts at the first spot with a place when there is no stay, and leaves short lists alone', () => {
    expect(
      shortestSpotOrder([at('a', 35, 135), at('c', 35.2, 135.2), at('b', 35.1, 135.1)]).map(
        (spot) => spot.name,
      ),
    ).toEqual(['a', 'b', 'c']);
    expect(shortestSpotOrder([at('x', null, null), at('y', 1, 1)]).map((s) => s.name)).toEqual([
      'y',
      'x',
    ]);
  });
});
