import type { GeocodingPort, PlaceResult, RateLimiter, SightResult } from '@globetrot/application';

const ATTRIBUTION = '© OpenStreetMap contributors · Geoapify';
const TIMEOUT_MS = 5000;

/** One Geoapify result to a place, or `null` when it has no usable name or point. */
export function toPlaceResult(result: Record<string, unknown>): PlaceResult | null {
  const longitude = Number(result.lon);
  const latitude = Number(result.lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const name =
    text(result.name) ??
    text(result.city) ??
    text(result.address_line1) ??
    text(typeof result.formatted === 'string' ? result.formatted.split(',')[0] : null);
  if (!name) return null;
  const code = text(result.country_code)?.toUpperCase() ?? null;
  return {
    key: `geoapify:${text(result.place_id) ?? `${longitude.toFixed(5)},${latitude.toFixed(5)}`}`.slice(
      0,
      200,
    ),
    name: name.slice(0, 200),
    countryCode: code && /^[A-Z]{2}$/.test(code) ? code : null,
    region: (text(result.state) ?? text(result.county))?.slice(0, 200) ?? null,
    latitude,
    longitude,
    attribution: ATTRIBUTION,
  };
}

/** Geoapify categories to the kinds of visit the Days screen shows; anything else is a landmark. */
export function sightKind(categories: readonly string[]): SightResult['kind'] {
  const has = (prefix: string) => categories.some((category) => category.startsWith(prefix));
  if (has('entertainment.museum') || has('entertainment.culture')) return 'museum';
  if (categories.some((category) => category.endsWith('.viewpoint'))) return 'viewpoint';
  if (has('beach')) return 'beach';
  if (has('leisure.park') || has('national_park')) return 'park';
  if (has('commercial.marketplace')) return 'market';
  return 'landmark';
}

/** One Geoapify place feature to a sight, or `null` without a name. */
export function toSightResult(feature: Record<string, unknown>): SightResult | null {
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const name = typeof properties.name === 'string' ? properties.name.trim() : '';
  if (!name) return null;
  const categories = Array.isArray(properties.categories)
    ? properties.categories.filter((value): value is string => typeof value === 'string')
    : [];
  return { name: name.slice(0, 120), kind: sightKind(categories), attribution: ATTRIBUTION };
}

const SIGHTS_TTL_MS = 24 * 60 * 60 * 1000;
const SIGHTS_CACHE_MAX = 500;
const SIGHTS_RADIUS_M = 8000;

/**
 * Geoapify behind the `GeocodingPort`. The key stays on the server. Failures (no key, timeouts, provider errors)
 * are reported as "unavailable", never thrown with the request URL (which carries the key).
 */
export function createGeoapifyGeocoder(
  apiKey: string | null,
  fetcher: typeof fetch = fetch,
): GeocodingPort {
  async function call(path: string, params: Record<string, string>) {
    if (!apiKey) return null;
    const url = new URL(`https://api.geoapify.com/v1/geocode/${path}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    url.searchParams.set('format', 'json');
    url.searchParams.set('apiKey', apiKey);
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      const body = (await response.json()) as { results?: Record<string, unknown>[] };
      return (body.results ?? [])
        .map(toPlaceResult)
        .filter((place): place is PlaceResult => place !== null);
    } catch {
      return null;
    }
  }
  // Sights near a city barely change: one call per area and language a day keeps the provider's quota for search.
  const sightsCache = new Map<string, { at: number; value: SightResult[] }>();
  async function sights(
    point: { readonly latitude: number; readonly longitude: number },
    options: { readonly language: string; readonly limit: number },
  ): Promise<SightResult[] | null> {
    if (!apiKey) return null;
    const cacheKey = `${point.latitude.toFixed(2)},${point.longitude.toFixed(2)},${options.language}`;
    const cached = sightsCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SIGHTS_TTL_MS)
      return cached.value.slice(0, options.limit);
    const url = new URL('https://api.geoapify.com/v2/places');
    const lonLat = `${point.longitude},${point.latitude}`;
    url.searchParams.set('categories', 'tourism.sights,tourism.attraction,entertainment.museum');
    url.searchParams.set('filter', `circle:${lonLat},${SIGHTS_RADIUS_M}`);
    url.searchParams.set('bias', `proximity:${lonLat}`);
    url.searchParams.set('limit', '20');
    url.searchParams.set('lang', options.language.slice(0, 2));
    url.searchParams.set('apiKey', apiKey);
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      const body = (await response.json()) as { features?: Record<string, unknown>[] };
      const seen = new Set<string>();
      const value = (body.features ?? [])
        .map(toSightResult)
        .filter((sight): sight is SightResult => {
          if (!sight || seen.has(sight.name.toLowerCase())) return false;
          seen.add(sight.name.toLowerCase());
          return true;
        });
      if (sightsCache.size >= SIGHTS_CACHE_MAX)
        sightsCache.delete(sightsCache.keys().next().value!);
      sightsCache.set(cacheKey, { at: Date.now(), value });
      return value.slice(0, options.limit);
    } catch {
      return null;
    }
  }

  return {
    sights,
    search: (query, { language, limit }) =>
      call('autocomplete', { text: query, lang: language, limit: String(limit) }),
    async reverse({ latitude, longitude }, { language }) {
      const found = await call('reverse', {
        lat: String(latitude),
        lon: String(longitude),
        lang: language,
      });
      return found === null ? undefined : (found[0] ?? null);
    },
  };
}

/**
 * Fixed one-minute windows in memory. Enough for one API process; several replicas each count on their own, which
 * only makes the limit looser (documented with the deployment work).
 */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    consume(key, limitPerMinute) {
      const time = now();
      const current = windows.get(key);
      if (!current || time - current.start >= 60_000) {
        windows.set(key, { start: time, count: 1 });
        if (windows.size > 10_000) {
          for (const [stale, value] of windows)
            if (time - value.start >= 60_000) windows.delete(stale);
        }
        return true;
      }
      current.count += 1;
      return current.count <= limitPerMinute;
    },
  };
}
