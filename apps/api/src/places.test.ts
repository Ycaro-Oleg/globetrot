import { describe, expect, it, vi } from 'vitest';
import { createGeoapifyGeocoder, createMemoryRateLimiter, toPlaceResult } from './places';

const KYOTO = {
  place_id: 'abc123',
  name: 'Kyoto',
  country_code: 'jp',
  state: 'Kyoto Prefecture',
  lat: 35.0116,
  lon: 135.7681,
};

describe('Geoapify geocoder', () => {
  it('maps a result to a place with a stable key, upper-case country and attribution', () => {
    expect(toPlaceResult(KYOTO)).toEqual({
      key: 'geoapify:abc123',
      name: 'Kyoto',
      countryCode: 'JP',
      region: 'Kyoto Prefecture',
      latitude: 35.0116,
      longitude: 135.7681,
      attribution: '© OpenStreetMap contributors · Geoapify',
    });
    expect(toPlaceResult({ lat: 'x', lon: 1, name: 'Nowhere' })).toBeNull();
    expect(toPlaceResult({ lat: 1, lon: 1 })).toBeNull();
  });

  it('sends the key only to Geoapify and returns the places', async () => {
    const fetcher = vi.fn(async () => Response.json({ results: [KYOTO] }));
    const geocoder = createGeoapifyGeocoder('server-key', fetcher as unknown as typeof fetch);
    const places = await geocoder.search('kyo', { language: 'pt', limit: 8 });
    expect(places?.map((place) => place.name)).toEqual(['Kyoto']);
    const url = (fetcher.mock.calls[0] as unknown as [URL])[0];
    expect(url.origin).toBe('https://api.geoapify.com');
    expect(url.searchParams.get('apiKey')).toBe('server-key');
    expect(url.searchParams.get('lang')).toBe('pt');
  });

  it('is unavailable without a key or when the provider fails, and never throws', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down https://api.geoapify.com/?apiKey=secret');
    });
    expect(
      await createGeoapifyGeocoder(null).search('kyoto', { language: 'en', limit: 8 }),
    ).toBeNull();
    const failing = createGeoapifyGeocoder('k', fetcher as unknown as typeof fetch);
    expect(await failing.search('kyoto', { language: 'en', limit: 8 })).toBeNull();
    expect(
      await failing.reverse({ latitude: 1, longitude: 1 }, { language: 'en' }),
    ).toBeUndefined();
    const empty = createGeoapifyGeocoder('k', (async () =>
      Response.json({ results: [] })) as unknown as typeof fetch);
    expect(await empty.reverse({ latitude: 0, longitude: 0 }, { language: 'en' })).toBeNull();
  });
});

describe('memory rate limiter', () => {
  it('allows the limit in a minute, then refuses until the window passes', () => {
    let time = 0;
    const limiter = createMemoryRateLimiter(() => time);
    expect([1, 2, 3].map(() => limiter.consume('a', 2))).toEqual([true, true, false]);
    expect(limiter.consume('b', 2)).toBe(true);
    time = 60_000;
    expect(limiter.consume('a', 2)).toBe(true);
  });
});
