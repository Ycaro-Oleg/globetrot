import { describe, expect, it } from 'vitest';
import { isCountryCode } from './countries';
import {
  POPULAR_PICKS,
  POPULAR_PLACES,
  popularPlaceByKey,
  searchPopularPlaces,
} from './popular-places';

describe('popular places', () => {
  it('have unique keys, real countries and sane coordinates', () => {
    expect(new Set(POPULAR_PLACES.map((p) => p.key)).size).toBe(POPULAR_PLACES.length);
    for (const place of POPULAR_PLACES) {
      expect(isCountryCode(place.countryCode)).toBe(true);
      expect(Math.abs(place.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(place.longitude)).toBeLessThanOrEqual(180);
    }
  });

  it('every one-tap pick exists', () => {
    for (const keys of Object.values(POPULAR_PICKS)) {
      for (const key of keys) expect(popularPlaceByKey(key)).toBeDefined();
    }
  });

  it('finds by English or Portuguese name, ignoring accents, prefixes first', () => {
    expect(searchPopularPlaces('lisb')[0]?.key).toBe('gt:lisbon');
    expect(searchPopularPlaces('Lisboa')[0]?.key).toBe('gt:lisbon');
    expect(searchPopularPlaces('toquio')[0]?.key).toBe('gt:tokyo');
    expect(searchPopularPlaces('sao')[0]?.pt.startsWith('São')).toBe(true);
    expect(searchPopularPlaces('x')).toEqual([]);
    expect(searchPopularPlaces('zzzz')).toEqual([]);
  });
});
