'use client';

import { LEG_MODES, type LegMode } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapCanvas, type MapPlace } from './map-canvas';
import {
  HISTORY_LIMIT,
  isEditable,
  LEG_ICONS,
  legsOf,
  MAX_NIGHTS,
  moveStop,
  NOTE_MAX,
  routeBody,
  type RouteStop,
} from './board-route';
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
/** Public browser key: map tiles only. Place search goes through the API (`/v1/places/*`), key on the server. */
const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
type Sheet = 'peek' | 'half' | 'full';
const SHEETS: Sheet[] = ['peek', 'half', 'full'];

type ApiPlace = {
  key: string;
  name: string;
  countryCode: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
};
const fromApi = (place: ApiPlace): MapPlace => ({
  id: place.key,
  name: place.name,
  country: '',
  countryCode: place.countryCode ?? '',
  region: place.region ?? '',
  longitude: place.longitude,
  latitude: place.latitude,
});
const asStop = (place: MapPlace): RouteStop => ({ ...place, nights: 0, note: '', legMode: null });

export function WorldMapBoard({
  tripId,
  initialRoute,
}: {
  /** The trip the route belongs to, or `null` when there is no trip yet (the board then works unsaved). */
  tripId: string | null;
  initialRoute: RouteStop[];
}) {
  const t = useTranslations('mapBoard');
  const locale = useLocale();
  const [stops, setStops] = useState<RouteStop[]>(initialRoute);
  /** Earlier versions of the route, newest last: what Undo goes back to. */
  const [history, setHistory] = useState<RouteStop[][]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  /** The route as last stored on the trip. What differs from it is not saved yet. */
  const [savedBody, setSavedBody] = useState(() => routeBody(initialRoute));
  const body = routeBody(stops);
  const unsaved = body !== savedBody;
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'pin' | 'thread'>('select');
  const [threadFrom, setThreadFrom] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<'unavailable' | 'busy' | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>('peek');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const centerRef = useRef<(() => { longitude: number; latitude: number }) | null>(null);
  const sheetStart = useRef<number | null>(null);
  /** A query long enough to search: below this the results, spinner and error are not shown. */
  const searchActive = query.trim().length >= 2;
  const selectedIndex = stops.findIndex((place) => place.id === selected);
  const activeStop = selectedIndex >= 0 ? stops[selectedIndex]! : null;
  const activeCity = activeStop ? null : (CITIES.find((city) => city.id === selected) ?? null);
  const legs = useMemo(() => legsOf(stops), [stops]);

  /** Every change that Undo can take back goes through here. */
  const commit = useCallback(
    (next: RouteStop[]) => {
      setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), stops]);
      setStops(next);
    },
    [stops],
  );
  const undo = useCallback(() => {
    setHistory((past) => {
      const previous = past.at(-1);
      if (previous) setStops(previous);
      return past.slice(0, -1);
    });
    setRemoved(null);
  }, []);

  // Ctrl+Z / Cmd+Z undoes the last board change, except while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'z' &&
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        !isEditable(event.target)
      ) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // The "removed" message with its Undo button goes away after a few seconds.
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(timer);
  }, [removed]);

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

  // Place search through the API: the provider key stays on the server.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ query: text, language: locale });
        const response = await fetch(`/v1/places/search?${params}`, { signal: controller.signal });
        if (response.status === 429) {
          setSearchError('busy');
          return;
        }
        if (!response.ok) throw new Error('search failed');
        const found = (await response.json()) as { places: ApiPlace[] };
        setResults(found.places.map(fromApi));
      } catch {
        if (!controller.signal.aborted) setSearchError('unavailable');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const updateStop = (id: string, change: Partial<RouteStop>) =>
    commit(stops.map((stop) => (stop.id === id ? { ...stop, ...change } : stop)));

  const changeNights = (id: string, change: number) => {
    const stop = stops.find((candidate) => candidate.id === id);
    if (stop) updateStop(id, { nights: Math.min(MAX_NIGHTS, Math.max(0, stop.nights + change)) });
  };

  const addPlace = (place: MapPlace) => {
    setSelected(place.id);
    if (!stops.some((stop) => stop.id === place.id)) commit([...stops, asStop(place)]);
  };

  const removeStop = (id: string) => {
    const stop = stops.find((candidate) => candidate.id === id);
    if (!stop) return;
    commit(stops.filter((candidate) => candidate.id !== id));
    setRemoved(nameOf(stop));
    if (selected === id) setSelected(null);
  };

  const toggleStop = (place: MapPlace) => {
    if (stops.some((stop) => stop.id === place.id)) removeStop(place.id);
    else addPlace(place);
  };

  const move = (index: number, to: number) => {
    const next = moveStop(stops, index, to);
    if (next.some((stop, i) => stop !== stops[i])) commit(next);
  };

  const onPlaceClick = (id: string) => {
    setSelected(id);
    if (tool === 'pin') {
      removeStop(id);
      return;
    }
    if (tool !== 'thread') return;
    if (!threadFrom) {
      setThreadFrom(id);
      return;
    }
    const from = stops.findIndex((place) => place.id === threadFrom);
    const to = stops.findIndex((place) => place.id === id);
    if (from >= 0 && to >= 0 && from !== to) move(from, from < to ? to : to + 1);
    setThreadFrom(null);
  };

  /** Adds a place at a point, then asks the API what is there to name it (the name changes, Undo is not needed). */
  const pinAt = (longitude: number, latitude: number) => {
    const id = `pin:${Date.now()}:${Math.round(longitude * 1000)}:${Math.round(latitude * 1000)}`;
    addPlace({
      id,
      name: t('mapPinName'),
      country: '',
      countryCode: '',
      region: '',
      longitude,
      latitude,
    });
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      language: locale,
    });
    void fetch(`/v1/places/reverse?${params}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((found: { place: ApiPlace | null } | null) => {
        if (!found?.place) return;
        const named = fromApi(found.place);
        setStops((current) =>
          current.map((stop) =>
            stop.id === id ? { ...stop, ...named, id, longitude, latitude } : stop,
          ),
        );
      })
      .catch(() => undefined);
  };

  const dropPin = (longitude: number, latitude: number) => {
    if (tool === 'pin') pinAt(longitude, latitude);
  };
  const pinHere = () => {
    const center = centerRef.current?.();
    if (center) pinAt(center.longitude, center.latitude);
  };

  const addFromSearch = (place: MapPlace) => {
    addPlace(place);
    setQuery('');
    setResults([]);
  };

  function nameOf(place: MapPlace) {
    const city = CITY_BY_ID.get(place.id);
    return city ? t(`places.${city.key}`) : place.name;
  }
  const countryOf = (place: MapPlace) => {
    const code = place.countryCode.toUpperCase();
    return code && t.has(`countries.${code}`) ? t(`countries.${code}`) : place.country;
  };
  const whereOf = (place: MapPlace) =>
    [place.region, countryOf(place)].filter(Boolean).join(', ') ||
    `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`;

  const threadPlace = threadFrom ? stops.find((place) => place.id === threadFrom) : null;
  const sample = (ids: string[]) => {
    const route = ids
      .map((id) => CITY_BY_ID.get(id))
      .filter((city): city is City => Boolean(city))
      .map(asStop);
    commit(route);
    setSelected(route[0]?.id ?? null);
  };

  const sheetMove = (direction: 1 | -1) =>
    setSheet(
      (current) =>
        SHEETS[Math.max(0, Math.min(SHEETS.length - 1, SHEETS.indexOf(current) + direction))]!,
    );

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
            className={styles.undoButton}
            onClick={undo}
            disabled={!history.length}
          >
            <span aria-hidden="true">↶</span> {t('undo')}
          </button>
          <button
            type="button"
            className={styles.exampleButton}
            onClick={() => sample(['tokyo', 'kyoto', 'osaka'])}
          >
            {t('japanRoute')}
          </button>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => sample([])}
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
              {threadPlace
                ? t('threadFrom', { place: nameOf(threadPlace) })
                : t(`toolHint.${tool}`)}
            </span>
          </div>
          <div className={styles.mapCanvas}>
            <MapCanvas
              route={stops}
              legs={legs}
              legIcons={LEG_ICONS}
              centerRef={centerRef}
              labels={{ map: t('mapAria'), loading: t('mapLoading'), error: t('mapError') }}
              selectedId={selected}
              apiKey={API_KEY}
              onPlaceClick={onPlaceClick}
              onMapPin={dropPin}
            />
            <span className={styles.crosshair} aria-hidden="true" />
            <button type="button" className={styles.pinHere} onClick={pinHere}>
              <span aria-hidden="true">⌖</span> {t('pinHere')}
            </button>
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

        <aside className={styles.panel} data-sheet={sheet} aria-label={t('sheet.label')}>
          <div className={styles.sheetBar}>
            <button
              type="button"
              className={styles.sheetHandle}
              aria-label={t('sheet.toggle')}
              onClick={() => setSheet((current) => (current === 'full' ? 'peek' : 'full'))}
              onPointerDown={(event) => {
                sheetStart.current = event.clientY;
              }}
              onPointerUp={(event) => {
                const start = sheetStart.current;
                sheetStart.current = null;
                if (start === null) return;
                const moved = event.clientY - start;
                if (Math.abs(moved) < 30) return;
                event.preventDefault();
                sheetMove(moved < 0 ? 1 : -1);
              }}
            >
              <span aria-hidden="true" />
            </button>
            <div className={styles.sheetSizes} role="group" aria-label={t('sheet.label')}>
              {SHEETS.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={sheet === size}
                  onClick={() => setSheet(size)}
                >
                  {t(`sheet.${size}`)}
                </button>
              ))}
            </div>
          </div>

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
          {searchActive ? (
            <div
              className={styles.searchResults}
              aria-label={t('searchResults')}
              aria-live="polite"
            >
              {searching ? (
                <p>{t('searching')}</p>
              ) : searchError === 'busy' ? (
                <p>{t('searchBusy')}</p>
              ) : searchError ? (
                <p>{t('searchUnavailable')}</p>
              ) : results.length ? (
                results.map((place) => (
                  <button type="button" key={place.id} onClick={() => addFromSearch(place)}>
                    <span>
                      <strong>{nameOf(place)}</strong>
                      <small>{whereOf(place)}</small>
                    </span>
                    <b>{stops.some((stop) => stop.id === place.id) ? '✓' : '+'}</b>
                  </button>
                ))
              ) : (
                <p>{t('noResults')}</p>
              )}
              {results.length ? (
                <small className={styles.attribution}>{t('searchAttribution')}</small>
              ) : null}
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
                {stops.map((place, index) => {
                  const next = stops[index + 1];
                  return (
                    <li
                      key={place.id}
                      className={`${selected === place.id ? styles.stopActive : ''} ${dragIndex === index ? styles.dragging : ''}`}
                      onDragOver={(event) => {
                        if (dragIndex !== null) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragIndex !== null) move(dragIndex, index);
                        setDragIndex(null);
                      }}
                    >
                      <span
                        className={styles.dragHandle}
                        draggable
                        aria-hidden="true"
                        title={t('dragHint')}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', place.id);
                          setDragIndex(index);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                      >
                        ⠿
                      </span>
                      <button
                        type="button"
                        className={styles.stopMain}
                        onClick={() => setSelected(place.id)}
                      >
                        <b>{index + 1}</b>
                        <span>
                          <strong>{nameOf(place)}</strong>
                          <small>{whereOf(place)}</small>
                          {next && place.legMode ? (
                            <small className={styles.legLine}>
                              <span aria-hidden="true">{LEG_ICONS[place.legMode]} </span>
                              {t('legSummary', {
                                mode: t(`legModes.${place.legMode}`),
                                place: nameOf(next),
                              })}
                            </small>
                          ) : null}
                        </span>
                      </button>
                      <div className={styles.stopControls}>
                        <div className={styles.order}>
                          <button
                            type="button"
                            aria-label={t('moveUp', { place: nameOf(place) })}
                            disabled={index === 0}
                            onClick={() => move(index, index - 1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={t('moveDown', { place: nameOf(place) })}
                            disabled={index === stops.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            ↓
                          </button>
                        </div>
                        <div className={styles.nights}>
                          <button
                            type="button"
                            aria-label={t('nightsFewer', { place: nameOf(place) })}
                            disabled={place.nights <= 0}
                            onClick={() => changeNights(place.id, -1)}
                          >
                            −
                          </button>
                          <output>{t('nights', { count: place.nights })}</output>
                          <button
                            type="button"
                            aria-label={t('nightsMore', { place: nameOf(place) })}
                            disabled={place.nights >= MAX_NIGHTS}
                            onClick={() => changeNights(place.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.removeStop}
                        aria-label={t('removePlace', { place: nameOf(place) })}
                        onClick={() => removeStop(place.id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className={styles.emptyRoute}>
                <strong>{t('emptyTitle')}</strong>
                <p>{t('emptyCopy')}</p>
              </div>
            )}

            {activeStop ? (
              <StopPanel
                key={activeStop.id}
                stop={activeStop}
                name={nameOf(activeStop)}
                where={whereOf(activeStop)}
                next={stops[selectedIndex + 1] ? nameOf(stops[selectedIndex + 1]!) : null}
                onChange={(change) => updateStop(activeStop.id, change)}
                onRemove={() => removeStop(activeStop.id)}
              />
            ) : activeCity ? (
              <div className={styles.placeDetail}>
                <span className={styles.detailEyebrow}>{t('selectedPlace')}</span>
                <h3>{nameOf(activeCity)}</h3>
                <p>{[activeCity.region, countryOf(activeCity)].filter(Boolean).join(' · ')}</p>
                <button type="button" onClick={() => toggleStop(activeCity)}>
                  {t('addToRoute')}
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

      {removed ? (
        <div className={styles.toast} role="status">
          <span>{t('removed', { place: removed })}</span>
          <button type="button" onClick={undo}>
            {t('undo')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The selected stop: its note, how to reach the next stop, and its costs. */
function StopPanel({
  stop,
  name,
  where,
  next,
  onChange,
  onRemove,
}: {
  stop: RouteStop;
  name: string;
  where: string;
  next: string | null;
  onChange: (change: Partial<RouteStop>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('mapBoard');
  // The note is typed here and saved to the route when the field is left, so Undo takes back a whole edit.
  const [note, setNote] = useState(stop.note);
  return (
    <section className={styles.stopPanel} aria-labelledby="stop-panel-title">
      <span className={styles.detailEyebrow}>{t('stopPanel')}</span>
      <h3 id="stop-panel-title">{name}</h3>
      <p>
        {where} · {t('nights', { count: stop.nights })}
      </p>
      <div className={styles.panelField}>
        <label htmlFor="stop-note">{t('note')}</label>
        <textarea
          id="stop-note"
          value={note}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder={t('notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => {
            if (note !== stop.note) onChange({ note });
          }}
        />
      </div>
      {next ? (
        <div className={styles.panelField}>
          <label htmlFor="stop-leg">{t('legTo', { place: next })}</label>
          <select
            id="stop-leg"
            value={stop.legMode ?? ''}
            onChange={(event) =>
              onChange({
                legMode: (LEG_MODES as readonly string[]).includes(event.target.value)
                  ? (event.target.value as LegMode)
                  : null,
              })
            }
          >
            <option value="">{t('legNone')}</option>
            {LEG_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`legModes.${mode}`)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className={styles.stopPanelActions}>
        <Link href="/app/budget">{t('costsLink')}</Link>
        <button type="button" onClick={onRemove}>
          {t('removeFromRoute')}
        </button>
      </div>
    </section>
  );
}
