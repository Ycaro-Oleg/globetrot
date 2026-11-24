import { describe, expect, it } from 'vitest';
import { POPULAR_PICKS, popularPlaceByKey } from './popular-places';
import { CITIES_WITH_SIGHTS, popularSightsFor, SIGHT_KINDS, SIGHT_MINUTES } from './popular-sights';

describe('popular sights', () => {
  it('cover every city offered in onboarding, each a known popular place with six named sights', () => {
    const picks = new Set(Object.values(POPULAR_PICKS).flat());
    for (const key of picks) expect(CITIES_WITH_SIGHTS, key).toContain(key);
    for (const key of CITIES_WITH_SIGHTS) {
      expect(popularPlaceByKey(key), key).toBeDefined();
      const sights = popularSightsFor(key);
      expect(sights, key).toHaveLength(6);
      for (const sight of sights) {
        expect(sight.en.trim().length).toBeGreaterThan(1);
        expect(sight.pt.trim().length).toBeGreaterThan(1);
        expect(SIGHT_KINDS).toContain(sight.kind);
      }
    }
  });

  it('has a typical time for every kind, and nothing for other cities', () => {
    for (const kind of SIGHT_KINDS) expect(SIGHT_MINUTES[kind]).toBeGreaterThanOrEqual(15);
    expect(popularSightsFor('gt:nowhere')).toEqual([]);
    expect(popularSightsFor('geoapify:123')).toEqual([]);
  });

  it('gives a day trip or a theme park most of a day, never an hour', () => {
    const lisbon = popularSightsFor('gt:lisbon').find((sight) => sight.en === 'Day trip to Sintra');
    const orlando = popularSightsFor('gt:orlando').find((sight) => sight.en === 'Magic Kingdom');
    expect(lisbon?.kind).toBe('daytrip');
    expect(orlando?.kind).toBe('daytrip');
    expect(SIGHT_MINUTES.daytrip).toBeGreaterThanOrEqual(6 * 60);
    // Every sight named as a day trip is classed as one.
    for (const key of CITIES_WITH_SIGHTS) {
      for (const sight of popularSightsFor(key)) {
        if (/day trip/i.test(sight.en)) expect(sight.kind, sight.en).toBe('daytrip');
      }
    }
  });
});
