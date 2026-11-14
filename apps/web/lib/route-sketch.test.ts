import { describe, expect, it } from 'vitest';
import { arcPath, routeSketch } from './route-sketch';

describe('routeSketch', () => {
  it('puts one stop in the middle', () => {
    expect(routeSketch([{ latitude: 38.7, longitude: -9.1 }], 400, 200)).toEqual([
      { x: 200, y: 100 },
    ]);
  });

  it('fits a route inside the margin, north up, west left', () => {
    const [lisbon, rome] = routeSketch(
      [
        { latitude: 38.7, longitude: -9.1 },
        { latitude: 41.9, longitude: 12.5 },
      ],
      400,
      200,
      20,
    );
    expect(lisbon!.x).toBe(20);
    expect(rome!.x).toBe(380);
    expect(rome!.y).toBeLessThan(lisbon!.y);
  });

  it('draws nothing for no stops, and arcs upwards', () => {
    expect(routeSketch([], 100, 100)).toEqual([]);
    expect(arcPath({ x: 0, y: 50 }, { x: 100, y: 50 })).toBe('M0 50 Q50 30 100 50');
  });
});
