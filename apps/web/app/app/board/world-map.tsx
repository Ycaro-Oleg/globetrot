'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MapCanvas, type MapPlace } from './map-canvas';
import styles from './world-map.module.css';

type City = MapPlace & { key: string };
const CITIES: City[] = [
  {
    id: 'new-york',
    key: 'newYork',
    name: 'New York',
    country: 'United States',
    countryCode: 'US',
    region: 'New York',
    longitude: -74.006,
    latitude: 40.7128,
  },
  {
    id: 'rio',
    key: 'rio',
    name: 'Rio de Janeiro',
    country: 'Brazil',
    countryCode: 'BR',
    region: 'Rio de Janeiro',
    longitude: -43.2,
    latitude: -22.9,
  },
  {
    id: 'buenos-aires',
    key: 'buenosAires',
    name: 'Buenos Aires',
    country: 'Argentina',
    countryCode: 'AR',
    region: 'Buenos Aires',
    longitude: -58.38,
    latitude: -34.6,
  },
  {
    id: 'lisbon',
    key: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    countryCode: 'PT',
    region: 'Lisbon',
    longitude: -9.14,
    latitude: 38.72,
  },
  {
    id: 'paris',
    key: 'paris',
    name: 'Paris',
    country: 'France',
    countryCode: 'FR',
    region: 'Ile-de-France',
    longitude: 2.35,
    latitude: 48.86,
  },
  {
    id: 'cape-town',
    key: 'capeTown',
    name: 'Cape Town',
    country: 'South Africa',
    countryCode: 'ZA',
    region: 'Western Cape',
    longitude: 18.42,
    latitude: -33.92,
  },
  {
    id: 'tokyo',
    key: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    region: 'Tokyo',
    longitude: 139.69,
    latitude: 35.67,
  },
  {
    id: 'kyoto',
    key: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    countryCode: 'JP',
    region: 'Kyoto',
    longitude: 135.77,
    latitude: 35.01,
  },
  {
    id: 'osaka',
    key: 'osaka',
    name: 'Osaka',
    country: 'Japan',
    countryCode: 'JP',
    region: 'Osaka',
    longitude: 135.5,
    latitude: 34.7,
  },
  {
    id: 'sydney',
    key: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    countryCode: 'AU',
    region: 'New South Wales',
    longitude: 151.2,
    latitude: -33.87,
  },
];
const CITY_BY_ID = new Map(CITIES.map((city) => [city.id, city]));
const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';

function toPlace(result: Record<string, unknown>): MapPlace | null {
  const longitude = Number(result.lon);
  const latitude = Number(result.lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const formatted = typeof result.formatted === 'string' ? result.formatted : '';
  const name =
    typeof result.name === 'string' && result.name
      ? result.name
      : typeof result.address_line1 === 'string' && result.address_line1
        ? result.address_line1
        : formatted.split(',')[0]?.trim();
  if (!name) return null;
  const id = typeof result.place_id === 'string' ? result.place_id : `geo:${longitude}:${latitude}`;
  return {
    id,
    name,
    country: typeof result.country === 'string' ? result.country : '',
    countryCode: typeof result.country_code === 'string' ? result.country_code.toUpperCase() : '',
    region:
      typeof result.state === 'string'
        ? result.state
        : typeof result.county === 'string'
          ? result.county
          : '',
    longitude,
    latitude,
  };
}

/** What the API stores for one stop. Nights are kept as loaded: the board does not edit them yet. */
function toDestination(place: MapPlace, nights: number) {
  return {
    placeKey: place.id.slice(0, 200),
    name: place.name.trim().slice(0, 200) || place.id.slice(0, 200),
    countryCode: /^[A-Z]{2}$/.test(place.countryCode) ? place.countryCode : null,
    region: place.region.trim().slice(0, 200) || null,
    latitude: place.latitude,
    longitude: place.longitude,
    nights,
  };
}

export function WorldMapBoard({
  tripId,
  initialStops,
  initialNights,
}: {
  /** The trip the route belongs to, or `null` when there is no trip yet (the board then works unsaved). */
  tripId: string | null;
  initialStops: MapPlace[];
  initialNights: Record<string, number>;
}) {
  const t = useTranslations('mapBoard');
  const locale = useLocale();
  const [stops, setStops] = useState<MapPlace[]>(initialStops);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const routeBody = (places: MapPlace[]) =>
    JSON.stringify(places.map((place) => toDestination(place, initialNights[place.id] ?? 0)));
  /** The route as last stored on the trip. What differs from it is not saved yet. */
  const [savedBody, setSavedBody] = useState(() => routeBody(initialStops));
  const body = routeBody(stops);
  const unsaved = body !== savedBody;
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'pin' | 'thread'>('select');
  const [threadFrom, setThreadFrom] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  /** A query long enough to search: below this the results, spinner and error are not shown. */
  const searchActive = query.trim().length >= 2;
  const active =
    stops.find((place) => place.id === selected) ??
    CITIES.find((city) => city.id === selected) ??
    null;

  // Every change to the route is saved to the trip, a moment after the last one (or when "try again" is pressed).
  useEffect(() => {
    if (!tripId || body === savedBody) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/v1/trips/${tripId}/destinations`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: `{"destinations":${body}}`,
        });
        if (!response.ok) throw new Error('save failed');
        setFailed(false);
        setSavedBody(body);
      } catch {
        setFailed(true);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [body, savedBody, tripId, retry]);

  useEffect(() => {
    const text = query.trim();
    // Too short a query, or no key: nothing to fetch (the derived values below show the right state).
    if (text.length < 2 || !API_KEY) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
        url.searchParams.set('text', text);
        url.searchParams.set('lang', locale === 'pt-BR' ? 'pt' : 'en');
        url.searchParams.set('limit', '8');
        url.searchParams.set('format', 'json');
        url.searchParams.set('apiKey', API_KEY);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Search request failed');
        const body = (await response.json()) as { results?: Record<string, unknown>[] };
        setResults(
          (body.results ?? []).map(toPlace).filter((place): place is MapPlace => Boolean(place)),
        );
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const addPlace = useCallback((place: MapPlace) => {
    setSelected(place.id);
    setStops((current) =>
      current.some((stop) => stop.id === place.id) ? current : [...current, place],
    );
  }, []);

  const toggleStop = useCallback((place: MapPlace) => {
    setSelected(place.id);
    setStops((current) =>
      current.some((stop) => stop.id === place.id)
        ? current.filter((stop) => stop.id !== place.id)
        : [...current, place],
    );
  }, []);

  const reorderOrSelect = useCallback(
    (id: string) => {
      setSelected(id);
      if (tool === 'pin') {
        const place = stops.find((stop) => stop.id === id);
        if (place) toggleStop(place);
        return;
      }
      if (tool !== 'thread') return;
      if (!threadFrom) {
        setThreadFrom(id);
        return;
      }
      setStops((current) => {
        if (
          !current.some((place) => place.id === threadFrom) ||
          !current.some((place) => place.id === id) ||
          threadFrom === id
        )
          return current;
        const next = current.filter((place) => place.id !== threadFrom);
        const index = next.findIndex((place) => place.id === id);
        next.splice(
          index + 1,
          0,
          current.find((place) => place.id === threadFrom)!,
        );
        return next;
      });
      setThreadFrom(null);
    },
    [tool, threadFrom, stops, toggleStop],
  );

  const dropPin = useCallback(
    (longitude: number, latitude: number) => {
      if (tool !== 'pin') return;
      const id = `pin:${Date.now()}:${Math.round(longitude * 1000)}:${Math.round(latitude * 1000)}`;
      const fallback = locale === 'pt-BR' ? 'Lugar marcado' : 'Pinned place';
      const dropped: MapPlace = {
        id,
        name: fallback,
        country: '',
        countryCode: '',
        region: '',
        longitude,
        latitude,
      };
      addPlace(dropped);
      if (!API_KEY) return;
      const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('lang', locale === 'pt-BR' ? 'pt' : 'en');
      url.searchParams.set('format', 'json');
      url.searchParams.set('apiKey', API_KEY);
      void fetch(url)
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { results?: Record<string, unknown>[] } | null) => {
          const found = body?.results?.[0] ? toPlace(body.results[0]) : null;
          if (found)
            setStops((current) =>
              current.map((place) => (place.id === id ? { ...found, id } : place)),
            );
        })
        .catch(() => undefined);
    },
    [tool, locale, addPlace],
  );

  const addFromSearch = (place: MapPlace) => {
    addPlace(place);
    setQuery('');
    setResults([]);
  };

  const nameOf = (place: MapPlace) => {
    const city = CITY_BY_ID.get(place.id);
    return city ? t(`places.${city.key}`) : place.name;
  };
  const countryOf = (place: MapPlace) => {
    const code = place.countryCode.toUpperCase();
    return code && t.has(`countries.${code}`) ? t(`countries.${code}`) : place.country;
  };

  const activeForHint = threadFrom ? stops.find((place) => place.id === threadFrom) : null;
  const example = (ids: string[]) => {
    const route = ids.map((id) => CITY_BY_ID.get(id)).filter((city): city is City => Boolean(city));
    setStops(route);
    setSelected(route[0]?.id ?? null);
  };

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p className={styles.lead}>{t('description')}</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.exampleButton}
            onClick={() => example(['tokyo', 'kyoto', 'osaka'])}
          >
            {t('japanRoute')}
          </button>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => example([])}
            disabled={stops.length === 0}
          >
            {t('clearRoute')}
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.mapCard} aria-label={t('mapLabel')}>
          <div className={styles.mapToolbar}>
            <div className={styles.toolGroup} role="group" aria-label={t('tools')}>
              {(['select', 'pin', 'thread'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={tool === key}
                  className={tool === key ? styles.toolActive : ''}
                  onClick={() => {
                    setTool(key);
                    setThreadFrom(null);
                  }}
                >
                  {key === 'select' ? '↖' : key === 'pin' ? '⌖' : '⌁'}{' '}
                  <span>{t(`tool.${key}`)}</span>
                </button>
              ))}
            </div>
            <span className={styles.mapHint}>
              {threadFrom && activeForHint
                ? t('threadFrom', { place: nameOf(activeForHint) })
                : t(`toolHint.${tool}`)}
            </span>
          </div>
          <div className={styles.mapCanvas}>
            <MapCanvas
              route={stops}
              selectedId={selected}
              apiKey={API_KEY}
              locale={locale}
              onPlaceClick={reorderOrSelect}
              onMapPin={dropPin}
            />
            {stops.length ? (
              <div className={styles.routeCount}>{t('routeCount', { count: stops.length })}</div>
            ) : null}
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.legendRoute} />
              {t('routeLegend')}
            </span>
            <span>
              <i className={styles.legendSelected} />
              {t('selectedLegend')}
            </span>
            <span className={styles.localSaved} role="status" aria-live="polite">
              {tripId === null ? (
                <>
                  {t('notSaved')} <Link href="/app/trips">{t('notSavedLink')}</Link>
                </>
              ) : unsaved && !failed ? (
                t('saving')
              ) : unsaved ? (
                <>
                  {t('saveError')}{' '}
                  <button type="button" onClick={() => setRetry((count) => count + 1)}>
                    {t('saveRetry')}
                  </button>
                </>
              ) : (
                t('saved')
              )}
            </span>
          </div>
        </section>

        <aside className={styles.panel}>
          <label className={styles.searchLabel} htmlFor="place-search">
            {t('search')}
          </label>
          <div className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input
              id="place-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          {query.trim().length >= 2 ? (
            <div
              className={styles.searchResults}
              aria-label={t('searchResults')}
              aria-live="polite"
            >
              {searchActive && searching ? (
                <p>{t('searching')}</p>
              ) : searchActive && (searchError || !API_KEY) ? (
                <p>{t('searchUnavailable')}</p>
              ) : searchActive && results.length ? (
                results.map((place) => (
                  <button type="button" key={place.id} onClick={() => addFromSearch(place)}>
                    <span>
                      <strong>{nameOf(place)}</strong>
                      <small>{[place.region, countryOf(place)].filter(Boolean).join(', ')}</small>
                    </span>
                    <b>{stops.some((stop) => stop.id === place.id) ? '✓' : '+'}</b>
                  </button>
                ))
              ) : (
                <p>{t('noResults')}</p>
              )}
            </div>
          ) : null}

          <div className={styles.panelSection}>
            <div className={styles.panelTitle}>
              <div>
                <p className={styles.eyebrow}>{t('yourRoute')}</p>
                <h2>{t('stopsTitle', { count: stops.length })}</h2>
              </div>
            </div>
            {stops.length ? (
              <ol className={styles.stopList}>
                {stops.map((place, index) => (
                  <li key={place.id} className={selected === place.id ? styles.stopActive : ''}>
                    <button type="button" onClick={() => setSelected(place.id)}>
                      <b>{index + 1}</b>
                      <span>
                        <strong>{nameOf(place)}</strong>
                        <small>
                          {[place.region, countryOf(place)].filter(Boolean).join(', ') ||
                            `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.removeStop}
                      aria-label={t('removePlace', { place: nameOf(place) })}
                      onClick={() => toggleStop(place)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.emptyRoute}>
                <strong>{t('emptyTitle')}</strong>
                <p>{t('emptyCopy')}</p>
              </div>
            )}
            {active ? (
              <div className={styles.placeDetail}>
                <span className={styles.detailEyebrow}>{t('selectedPlace')}</span>
                <h3>{nameOf(active)}</h3>
                <p>
                  {[placeRegion(active, nameOf(active)), countryOf(active)]
                    .filter(Boolean)
                    .join(' · ') || `${active.latitude.toFixed(3)}, ${active.longitude.toFixed(3)}`}
                </p>
                <button type="button" onClick={() => toggleStop(active)}>
                  {stops.some((place) => place.id === active.id)
                    ? t('removeFromRoute')
                    : t('addToRoute')}
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.suggestions}>
            <p className={styles.eyebrow}>{t('popularPlaces')}</p>
            <div>
              {['lisbon', 'rio', 'tokyo', 'paris'].map((id) => {
                const city = CITY_BY_ID.get(id)!;
                const onRoute = stops.some((place) => place.id === id);
                return (
                  <button key={id} type="button" onClick={() => toggleStop(city)}>
                    {onRoute ? '✓ ' : '+ '}
                    {nameOf(city)}
                  </button>
                );
              })}
            </div>
          </div>
          <a href="/app/trips" className={styles.backTrips}>
            {t('backToTrips')} <span aria-hidden="true">→</span>
          </a>
        </aside>
      </div>
    </div>
  );
}

function placeRegion(place: MapPlace, localizedName: string) {
  const city = CITY_BY_ID.get(place.id);
  return city ? city.region : place.region || localizedName;
}
