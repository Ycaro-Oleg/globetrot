import { describe, expect, it } from 'vitest';
import { fitPadding } from './fit-padding';

describe('fitPadding', () => {
  it('keeps the padding when the route has room', () => {
    // The half sheet on a phone: 625 px of map, 106 above and 352 below.
    const padding = { top: 106, right: 50, bottom: 352, left: 50 };
    expect(fitPadding(padding, 390, 625)).toEqual(padding);
  });

  it('shrinks top and bottom together when the phone sheet covers too much of the map', () => {
    // A full sheet on a short phone: 106 + 590 is more than the 625 px of map.
    const fitted = fitPadding({ top: 106, right: 50, bottom: 590, left: 50 }, 390, 625);
    expect(fitted.top + fitted.bottom).toBeLessThanOrEqual(625 - 625 * 0.2);
    expect(fitted.bottom).toBeGreaterThan(fitted.top);
    expect(fitted.left).toBe(50);
  });

  it('leaves at least the minimum in pixels on a tiny map', () => {
    const fitted = fitPadding({ top: 100, right: 300, bottom: 100, left: 300 }, 200, 200);
    expect(200 - fitted.left - fitted.right).toBeGreaterThanOrEqual(80);
    expect(200 - fitted.top - fitted.bottom).toBeGreaterThanOrEqual(80);
  });

  it('does nothing before the map has a size', () => {
    const padding = { top: 10, right: 10, bottom: 10, left: 10 };
    expect(fitPadding(padding, 0, 0)).toEqual(padding);
  });
});
