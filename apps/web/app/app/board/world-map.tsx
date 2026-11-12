'use client';

import { LEG_MODES, type LegMode } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  distanceKm,
  HISTORY_LIMIT,
  isEditable,
  KIT_TABS,
  LEG_ICONS,
  MAX_NIGHTS,
  moveStop,
  newStop,
  routeBody,
  stopDays,
  zoomLevel,
  type KitTab,
  type MapPlace,
  type RouteStop,
} from './board-route';
import {
  MapCanvas,
  type BoardMapController,
  type Inset,
  type MapStop,
  type NearbyPlace,
} from './map-canvas';
import { MAP_STYLES, SWATCHES, type MapStyleName } from './map-styles';
import { kitCounts, PinCard } from './pin-card';
import { VisaOverlay, type StampedVisa } from './visa-overlay';
import styles from './world-map.module.css';

/** Public browser key: map tiles only. Place search goes through the API (`/v1/places/*`), key on the server. */
const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
const STYLE_KEY = 'globetrot.mapStyle';
const PHONE_MAX = 720;
const PANEL_INSET = 412;
type Sheet = 'peek' | 'half' | 'full';
type Tool = 'select' | 'pin';

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
  countryCode: place.countryCode ?? '',
  region: place.region ?? '',
  longitude: place.longitude,
  latitude: place.latitude,
});

/** The sample route (design handoff: a Japan spring trip). Spot names are proper nouns, the same in every language. */
const SAMPLE = [
  {
    key: 'tokyo',
    region: 'Tokyo',
    longitude: 139.7671,
    latitude: 35.6812,
    nights: 4,
    spots: [
      ['Senso-ji', 139.7967, 35.7148],
      ['Shibuya Crossing', 139.7005, 35.6595],
      ['teamLab Planets', 139.7845, 35.6491],
    ],
  },
  {
    key: 'hakone',
    region: 'Kanagawa',
    longitude: 139.1069,
    latitude: 35.2324,
    nights: 1,
    spots: [
      ['Lake Ashi', 139.0235, 35.2045],
      ['Hakone Open-Air Museum', 139.0517, 35.2449],
    ],
  },
  {
    key: 'kyoto',
    region: 'Kyoto',
    longitude: 135.7588,
    latitude: 34.9858,
    nights: 4,
    spots: [
      ['Fushimi Inari', 135.7727, 34.9671],
      ['Kiyomizu-dera', 135.785, 34.9949],
      ['Gion', 135.7752, 35.0037],
    ],
  },
  {
    key: 'osaka',
    region: 'Osaka',
    longitude: 135.4959,
    latitude: 34.7025,
    nights: 2,
    spots: [
      ['Dotonbori', 135.5013, 34.6687],
      ['Osaka Castle', 135.5262, 34.6873],
    ],
  },
] as const;

function readStyle(): MapStyleName {
  try {
    const value = window.localStorage.getItem(STYLE_KEY);
    return (MAP_STYLES as readonly string[]).includes(value ?? '')
      ? (value as MapStyleName)
      : 'atlas';
  } catch {
    return 'atlas';
  }
}

export function WorldMapBoard({
  tripId,
  tripTitle,
  startDate,
  initialRoute,
  initialVisas,
}: {
  /** The trip the route belongs to, or `null` when there is no trip yet (the board then works unsaved). */
  tripId: string | null;
  tripTitle: string | null;
  startDate: string | null;
  initialRoute: RouteStop[];
  /** Countries with a commemorative visa already. */
  initialVisas: string[];
}) {
  const t = useTranslations('mapBoard');
  const locale = useLocale();
  const [stops, setStops] = useState<RouteStop[]>(initialRoute);
  /** Earlier versions of the route, newest last: what Undo goes back to. */
  const [history, setHistory] = useState<RouteStop[][]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [savedBody, setSavedBody] = useState(() => routeBody(initialRoute));
  const body = routeBody(stops);
  const unsaved = body !== savedBody;
  const [selected, setSelected] = useState<string | null>(null);
  const [card, setCard] = useState<{ id: string; tab: KitTab } | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<'unavailable' | 'busy' | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: boolean } | null>(null);
  const [sheet, setSheet] = useState<Sheet>('half');
  const [zoom, setZoom] = useState(1.4);
  const [styleName, setStyleName] = useState<MapStyleName>('atlas');
  const [visited, setVisited] = useState<string[]>(initialVisas);
  const [visa, setVisa] = useState<StampedVisa | null>(null);
  const [nearby, setNearby] = useState<{ id: string; places: NearbyPlace[] } | null>(null);
  const [view, setView] = useState({ w: 1280, h: 800, phone: false, stageH: 0 });
  const [cardStyle, setCardStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const stage = useRef<HTMLDivElement>(null);
  const controller = useRef<BoardMapController | null>(null);
  const nearbyTimer = useRef(0);

  const selectedIndex = stops.findIndex((stop) => stop.id === selected);
  const active = selectedIndex >= 0 ? stops[selectedIndex]! : null;
  const cardIndex = card ? stops.findIndex((stop) => stop.id === card.id) : -1;
  const cardStop = cardIndex >= 0 ? stops[cardIndex]! : null;
  const phone = view.phone;
  const searchActive = query.trim().length >= 2;

  // The card sits next to its pin and follows the map; on a phone it opens full width at the top.
  const placeCard = useCallback(() => {
    if (!cardStop) return;
    const width = stage.current?.clientWidth ?? view.w;
    const height = view.stageH;
    if (phone) {
      setCardStyle({ left: 12, top: 72, width: width - 24, maxHeight: Math.round(height * 0.5) });
      return;
    }
    const maxHeight = Math.min(460, height - 100);
    const point = controller.current?.project(cardStop.longitude, cardStop.latitude) ?? {
      x: width / 2,
      y: height / 2,
    };
    let left = point.x + 36;
    if (left + 340 > width - PANEL_INSET) left = point.x - 36 - 340;
    left = Math.max(12, left);
    const top = Math.max(72, Math.min(height - maxHeight - 14, point.y - 150));
    setCardStyle({ left, top, width: 340, maxHeight });
  }, [cardStop, phone, view.w, view.stageH]);
  useEffect(() => {
    const frame = requestAnimationFrame(placeCard);
    return () => cancelAnimationFrame(frame);
  }, [placeCard]);

  // The remembered style is read after the first paint, so the server and the browser render the same page.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStyleName(readStyle()));
    return () => cancelAnimationFrame(frame);
  }, []);

  // The board fills the space under the app's top bar (and above the phone's tab bar).
  useEffect(() => {
    const measure = () => {
      const top = stage.current?.getBoundingClientRect().top ?? 0;
      const isPhone = window.innerWidth < PHONE_MAX;
      const tabBar = document.querySelector('[data-shell-tabbar]')?.getBoundingClientRect();
      const reserve = isPhone && tabBar ? window.innerHeight - tabBar.top + 8 : 0;
      setView({
        w: window.innerWidth,
        h: window.innerHeight,
        phone: isPhone,
        stageH: Math.max(420, window.innerHeight - Math.max(0, top + window.scrollY) - reserve),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const sheetHeight = {
    peek: 150,
    half: Math.round(view.stageH * 0.5),
    full: Math.round(view.stageH * 0.88),
  }[sheet];
  const inset: Inset = phone
    ? { top: 76, right: 20, bottom: sheetHeight + 10, left: 20 }
    : { top: 80, right: PANEL_INSET, bottom: 60, left: 40 };

  const flash = useCallback((text: string, undo = false) => setToast({ text, undo }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 8000 : 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /** Every change that Undo can take back goes through here. */
  const commit = useCallback((next: RouteStop[] | ((current: RouteStop[]) => RouteStop[])) => {
    setStops((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (value !== current) setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), current]);
      return value;
    });
  }, []);
  const undo = useCallback(() => {
    setHistory((past) => {
      const previous = past.at(-1);
      if (previous) setStops(previous);
      return past.slice(0, -1);
    });
    setToast(null);
  }, []);
  const updateStop = useCallback(
    (id: string, change: Partial<RouteStop>) =>
      commit((current) => current.map((stop) => (stop.id === id ? { ...stop, ...change } : stop))),
    [commit],
  );

  // Every change is saved to the trip a moment after the last one. A save may stamp visas: celebrate the first.
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
        const saved = (await response.json()) as { stampedVisas?: StampedVisa[] };
        setFailed(false);
        setSavedBody(body);
        const stamped = saved.stampedVisas ?? [];
        if (stamped.length) {
          setVisited((current) => [...new Set([...current, ...stamped.map((v) => v.countryCode)])]);
          setVisa(stamped[0]!);
        }
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
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ query: text, language: locale });
        const response = await fetch(`/v1/places/search?${params}`, { signal: abort.signal });
        if (response.status === 429) {
          setSearchError('busy');
          return;
        }
        if (!response.ok) throw new Error('search failed');
        const found = (await response.json()) as { places: ApiPlace[] };
        setResults(found.places.map(fromApi));
      } catch {
        if (!abort.signal.aborted) setSearchError('unavailable');
      } finally {
        if (!abort.signal.aborted) setSearching(false);
      }
    }, 260);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [query, locale]);

  const select = useCallback(
    (id: string | null) => {
      setSelected(id);
      setNearby(null);
      window.clearTimeout(nearbyTimer.current);
      if (!id) return;
      const stop = stops.find((candidate) => candidate.id === id);
      if (!stop) return;
      if (phone && sheet === 'peek') setSheet('half');
      controller.current?.flyTo(stop.longitude, stop.latitude);
      // "Nearby" reads the points of interest drawn once the map has settled there.
      const read = () => {
        setNearby((current) =>
          current?.id === id
            ? current
            : {
                id,
                places: controller.current?.nearby(stop.longitude, stop.latitude, locale) ?? [],
              },
        );
      };
      controller.current?.onceIdle(read);
      // A fly to where the map already is fires no "moveend": read after a while anyway.
      nearbyTimer.current = window.setTimeout(read, 3500);
    },
    [stops, phone, sheet, locale],
  );

  const openCard = useCallback(
    (id: string, tab: KitTab | null) => {
      if (selected !== id) select(id);
      setCard((current) => ({ id, tab: tab ?? current?.tab ?? 'spots' }));
    },
    [selected, select],
  );

  const addPlace = (place: MapPlace, flyZoom = 11) => {
    if (!stops.some((stop) => stop.id === place.id)) commit([...stops, newStop(place)]);
    setSelected(place.id);
    controller.current?.flyTo(place.longitude, place.latitude, flyZoom);
  };

  const removeStop = (id: string) => {
    const stop = stops.find((candidate) => candidate.id === id);
    if (!stop) return;
    commit(stops.filter((candidate) => candidate.id !== id));
    if (selected === id) setSelected(null);
    if (card?.id === id) setCard(null);
    flash(t('removed', { place: stop.name }), true);
  };

  const move = (index: number, to: number) => {
    const next = moveStop(stops, index, to);
    if (next.some((stop, i) => stop !== stops[i])) commit(next);
  };

  const changeNights = (stop: RouteStop, change: number) =>
    updateStop(stop.id, { nights: Math.min(MAX_NIGHTS, Math.max(0, stop.nights + change)) });

  /** Adds a stop at a point, then asks the API what is there to fill in the region and country. */
  const pinAt = (longitude: number, latitude: number, name: string | null) => {
    const id = `pin:${Date.now()}:${Math.round(longitude * 1000)}:${Math.round(latitude * 1000)}`;
    const label = name ?? t('mapPinName');
    commit((current) => [
      ...current,
      newStop({ id, name: label, countryCode: '', region: '', longitude, latitude }),
    ]);
    setSelected(id);
    setTool('select');
    flash(t('pinned', { place: label }));
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      language: locale,
    });
    void fetch(`/v1/places/reverse?${params}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((found: { place: ApiPlace | null } | null) => {
        if (!found?.place) return;
        const place = fromApi(found.place);
        // Naming the pin is not a change of plan, so it does not go into Undo.
        setStops((current) =>
          current.map((stop) =>
            stop.id === id
              ? {
                  ...stop,
                  name: name ?? place.name,
                  region: place.region,
                  countryCode: place.countryCode,
                }
              : stop,
          ),
        );
      })
      .catch(() => undefined);
  };

  const pickResult = (place: MapPlace) => {
    addPlace(place);
    setQuery('');
    setResults([]);
  };

  const sample = () => {
    const route = SAMPLE.map((item) =>
      Object.assign(
        newStop({
          id: `catalog:${item.key}`,
          name: t(`places.${item.key}`),
          countryCode: 'JP',
          region: item.region,
          longitude: item.longitude,
          latitude: item.latitude,
        }),
        {
          nights: item.nights,
          legMode: 'train' as LegMode,
          spots: item.spots.map(([name, longitude, latitude]) => ({
            name,
            longitude,
            latitude,
            done: false,
          })),
        },
      ),
    );
    commit(route);
    window.setTimeout(() => controller.current?.fitStops(true), 50);
  };

  const toggleVisited = (stop: RouteStop) => updateStop(stop.id, { visited: !stop.visited });

  // Keyboard: V select, P pin, Esc closes what is on top, Ctrl/Cmd+Z undoes (never while typing).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (visa) setVisa(null);
        else if (card) setCard(null);
        else if (isEditable(event.target)) {
          setQuery('');
          setResults([]);
        } else if (tool === 'pin') setTool('select');
        else if (selected) setSelected(null);
        return;
      }
      if (isEditable(event.target) || visa) return;
      if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'v' || event.key === 'V') setTool('select');
      else if (event.key === 'p' || event.key === 'P') {
        setTool('pin');
        if (phone) setSheet('peek');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visa, card, tool, selected, undo, phone]);

  const days = (index: number) => {
    const range = stopDays(stops, index, startDate);
    if (!range) return null;
    const format = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    const short = (date: Date) => format.format(date).replace('.', '');
    return stops[index]!.nights
      ? `${short(range.start)} – ${short(range.end)}`
      : short(range.start);
  };
  const when = (index: number) =>
    [days(index), t('nights', { count: stops[index]!.nights })].filter(Boolean).join(' · ');
  const countryOf = (code: string) => {
    if (!code) return '';
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const whereOf = (place: MapPlace) =>
    [place.region, countryOf(place.countryCode)].filter(Boolean).join(', ');
  const coord = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
  const number = new Intl.NumberFormat(locale);
  const totalNights = stops.reduce((sum, stop) => sum + stop.nights, 0);

  const mapStops: MapStop[] = useMemo(
    () => stops.map((stop) => ({ ...stop, label: stop.name, counts: kitCounts(stop) })),
    [stops],
  );
  const petalNames = useMemo(
    () =>
      Object.fromEntries(KIT_TABS.map((tab) => [tab, t(`card.tabs.${tab}`)])) as Record<
        KitTab,
        string
      >,
    [t],
  );

  const level = zoomLevel(zoom);
  const saveStatus =
    tripId === null ? (
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
    );

  return (
    <div
      ref={stage}
      className={styles.stage}
      data-phone={phone || undefined}
      style={{ height: view.stageH || undefined }}
    >
      <MapCanvas
        stops={mapStops}
        selectedId={selected}
        styleName={styleName}
        locale={locale}
        tool={tool}
        visitedCountries={visited}
        inset={inset}
        phone={phone}
        apiKey={API_KEY}
        controllerRef={controller}
        text={{
          map: t('mapLabel'),
          loading: t('mapLoading'),
          error: t('mapError'),
          petal: petalNames,
          stop: (name, index) => t('stopAria', { place: name, index }),
        }}
        onSelect={select}
        onOpenCard={openCard}
        onPin={pinAt}
        onZoom={(value) =>
          setZoom((current) => (Math.abs(current - value) > 0.15 ? value : current))
        }
        onMove={() => {
          if (card) placeCard();
        }}
      />

      <div className={styles.toolbar}>
        <nav className={styles.crumbs} aria-label={t('crumbs')}>
          <button type="button" onClick={() => (select(null), controller.current?.fitWorld())}>
            {t('world')}
          </button>
          <span aria-hidden="true">›</span>
          <button
            type="button"
            aria-current={selected ? undefined : 'location'}
            onClick={() => (select(null), controller.current?.fitStops(true))}
            disabled={!stops.length}
          >
            {tripTitle ?? t('tripFallback')}
          </button>
        </nav>
        <div className={styles.search}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">{t('search')}</span>
            <input
              id="place-search"
              type="search"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) pickResult(results[0]);
              }}
              placeholder={t('searchPlaceholder')}
            />
            {searching ? <span className={styles.searchBusy}>…</span> : null}
          </label>
          {searchActive && !searching ? (
            <div className={styles.results} aria-live="polite" aria-label={t('searchResults')}>
              {searchError === 'busy' ? (
                <p>{t('searchBusy')}</p>
              ) : searchError ? (
                <p>{t('searchUnavailable')}</p>
              ) : results.length ? (
                <>
                  {results.map((place) => (
                    <button type="button" key={place.id} onClick={() => pickResult(place)}>
                      <strong>{place.name}</strong>
                      <span>{stops.some((stop) => stop.id === place.id) ? '✓' : '+'}</span>
                      <small>{whereOf(place)}</small>
                    </button>
                  ))}
                  <small className={styles.resultsSource}>{t('searchAttribution')}</small>
                </>
              ) : (
                <p>{t('noResults')}</p>
              )}
            </div>
          ) : null}
        </div>
        <div className={styles.tools} role="group" aria-label={t('tools')}>
          {(['select', 'pin'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tool === key}
              aria-keyshortcuts={key === 'select' ? 'V' : 'P'}
              onClick={() => {
                setTool(key);
                if (key === 'pin' && phone) setSheet('peek');
              }}
            >
              {t(`tool.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {tool === 'pin' ? (
        <div className={styles.hint} role="status">
          {phone ? t('pinHintPhone') : t('pinHint')}
        </div>
      ) : null}

      {!phone ? (
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.kicker}>{t('zoomShows')}</span>
            <span className={styles.mono}>z{zoom.toFixed(1)}</span>
          </div>
          <div className={styles.levels} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((step) => (
              <span key={step} data-on={step <= level || undefined} />
            ))}
          </div>
          <strong className={styles.levelName}>{t(`levels.${level}`)}</strong>
          <div className={styles.legendBlock}>
            <span className={styles.kicker} id="map-style-label">
              {t('mapStyle')}
            </span>
            <div className={styles.styles} role="radiogroup" aria-labelledby="map-style-label">
              {MAP_STYLES.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={styleName === name}
                  onClick={() => {
                    setStyleName(name);
                    try {
                      window.localStorage.setItem(STYLE_KEY, name);
                    } catch {
                      /* The choice just is not remembered. */
                    }
                  }}
                >
                  <span className={styles.swatch} aria-hidden="true">
                    {SWATCHES[name].map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  {t(`styles.${name}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.key}>
            <span>
              <i className={styles.keyTrip} aria-hidden="true" />
              {t('keyTrip')}
            </span>
            <span>
              <i className={styles.keyVisited} aria-hidden="true" />
              {t('keyVisited')}
            </span>
          </div>
          <div className={styles.shortcuts}>
            <span>
              <kbd>V</kbd> {t('tool.select')}
            </span>
            <span>
              <kbd>P</kbd> {t('tool.pin')}
            </span>
            <span>
              <kbd>Esc</kbd>
            </span>
          </div>
        </div>
      ) : null}

      <div
        className={styles.zoom}
        style={phone ? { bottom: sheetHeight + 24 } : undefined}
        role="group"
        aria-label={t('zoomGroup')}
      >
        <button
          type="button"
          onClick={() => controller.current?.zoomBy(1)}
          aria-label={t('zoomIn')}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => controller.current?.zoomBy(-1)}
          aria-label={t('zoomOut')}
        >
          −
        </button>
      </div>

      {phone && tool === 'pin' ? (
        <>
          <div
            className={styles.crosshair}
            aria-hidden="true"
            style={{ top: Math.round((inset.top + (view.stageH - sheetHeight)) / 2) }}
          />
          <button
            type="button"
            className={styles.pinHere}
            style={{ bottom: sheetHeight + 24 }}
            onClick={() => {
              const center = controller.current?.center();
              if (center) pinAt(center.longitude, center.latitude, null);
            }}
          >
            {t('pinHere')}
          </button>
        </>
      ) : null}

      {cardStop ? (
        <PinCard
          key={cardStop.id}
          stop={cardStop}
          index={cardIndex}
          name={cardStop.name}
          when={when(cardIndex)}
          tab={card!.tab}
          style={cardStyle}
          onTab={(tab) => setCard({ id: cardStop.id, tab })}
          onChange={(change) => updateStop(cardStop.id, change)}
          onShowSpot={(spot) =>
            spot.longitude !== null &&
            spot.latitude !== null &&
            controller.current?.flyTo(spot.longitude, spot.latitude, 16)
          }
          onClose={() => {
            setCard(null);
            setCardStyle({ visibility: 'hidden' });
          }}
        />
      ) : null}

      <section
        className={styles.panel}
        aria-label={t('panel')}
        style={phone ? { height: sheetHeight } : undefined}
        data-sheet={phone ? sheet : undefined}
      >
        {phone ? (
          <button
            type="button"
            className={styles.sheetHandle}
            aria-label={t('sheetToggle')}
            onClick={() =>
              setSheet((current) =>
                current === 'peek' ? 'half' : current === 'half' ? 'full' : 'peek',
              )
            }
          >
            <span aria-hidden="true" />
          </button>
        ) : null}

        {active ? (
          <div className={styles.panelScroll}>
            <button type="button" className={styles.back} onClick={() => select(null)}>
              ← {t('back')}
            </button>
            <div className={styles.detailHead}>
              <span className={styles.kicker}>
                {t('stopOf', { index: selectedIndex + 1, count: stops.length })}
              </span>
              <h2>{active.name}</h2>
              {whereOf(active) ? <span className={styles.muted}>{whereOf(active)}</span> : null}
              <span className={styles.mono}>
                {coord(active.latitude, 'N', 'S')} · {coord(active.longitude, 'E', 'W')}
              </span>
            </div>
            <div className={styles.stepper}>
              <button
                type="button"
                onClick={() => changeNights(active, -1)}
                disabled={active.nights <= 0}
                aria-label={t('nightsFewer', { place: active.name })}
              >
                −
              </button>
              <span aria-live="polite">
                <strong>{t('nights', { count: active.nights })}</strong>
                {days(selectedIndex) ? <small>{days(selectedIndex)}</small> : null}
              </span>
              <button
                type="button"
                onClick={() => changeNights(active, 1)}
                disabled={active.nights >= MAX_NIGHTS}
                aria-label={t('nightsMore', { place: active.name })}
              >
                +
              </button>
            </div>
            <div className={styles.kitButtons} role="group" aria-label={t('kitGroup')}>
              {KIT_TABS.map((tab) => (
                <button key={tab} type="button" onClick={() => openCard(active.id, tab)}>
                  <span aria-hidden="true">
                    {{ photos: '▣', spots: '⌖', notes: '✎', todos: '✓' }[tab]}
                  </span>
                  {petalNames[tab]}
                  {kitCounts(active)[tab] ? <b>{kitCounts(active)[tab]}</b> : null}
                </button>
              ))}
            </div>
            <div className={styles.block}>
              <div className={styles.blockHead}>
                <span className={styles.kicker}>{t('nearby')}</span>
                <small>{t('nearbySource')}</small>
              </div>
              {nearby?.id !== active.id ? (
                <small className={styles.muted}>{t('nearbyLoading')}</small>
              ) : nearby.places.length ? (
                nearby.places.map((place) => (
                  <button
                    key={place.name}
                    type="button"
                    className={styles.nearbyItem}
                    onClick={() => controller.current?.flyTo(place.longitude, place.latitude, 17)}
                  >
                    <span>{place.name}</span>
                    <small>{place.kind.replace(/_/g, ' ')}</small>
                  </button>
                ))
              ) : (
                <small className={styles.muted}>{t('nearbyEmpty')}</small>
              )}
            </div>
            {stops[selectedIndex + 1] ? (
              <div className={styles.block}>
                <label htmlFor="stop-leg" className={styles.kicker}>
                  {t('legTo', { place: stops[selectedIndex + 1]!.name })}
                </label>
                <select
                  id="stop-leg"
                  className={styles.select}
                  value={active.legMode ?? ''}
                  onChange={(event) =>
                    updateStop(active.id, {
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
            <div className={styles.block}>
              <button
                type="button"
                className={styles.visitButton}
                aria-pressed={active.visited}
                onClick={() => toggleVisited(active)}
              >
                ✓ {active.visited ? t('visitedUndo') : t('markVisited')}
              </button>
              <small className={styles.muted}>{t('visitHelp')}</small>
            </div>
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => removeStop(active.id)}
            >
              {t('removeStop')}
            </button>
          </div>
        ) : (
          <div className={styles.panelScroll}>
            <div className={styles.routeHead}>
              <div className={styles.legendRow}>
                <span className={styles.kicker}>{t('route')}</span>
                <button
                  type="button"
                  className={styles.undo}
                  onClick={undo}
                  disabled={!history.length}
                >
                  <span aria-hidden="true">↶</span> {t('undo')}
                </button>
              </div>
              <h1>{tripTitle ?? t('title')}</h1>
              <span className={styles.muted}>
                {[
                  t('stopsCount', { count: stops.length }),
                  totalNights ? t('nights', { count: totalNights }) : null,
                  startDate
                    ? `✈ ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${startDate}T00:00:00Z`))}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {stops.length ? (
              <ol className={styles.stops}>
                {stops.map((stop, index) => {
                  const next = stops[index + 1];
                  const state =
                    stop.id === selected ? 'selected' : stop.visited ? 'visited' : 'planned';
                  return (
                    <li key={stop.id}>
                      <div className={styles.stopRow} data-state={state}>
                        <button
                          type="button"
                          className={styles.disc}
                          data-state={state}
                          onClick={() => select(stop.id)}
                          aria-label={t('stopAria', { place: stop.name, index: index + 1 })}
                        >
                          {stop.visited ? '✓' : index + 1}
                        </button>
                        <button
                          type="button"
                          className={styles.stopMain}
                          onClick={() => select(stop.id)}
                        >
                          <strong>{stop.name}</strong>
                          <small>
                            {when(index)}
                            {stop.visited ? ` · ${t('keyVisited')}` : ''}
                          </small>
                        </button>
                        <div className={styles.order}>
                          <button
                            type="button"
                            aria-label={t('moveUp', { place: stop.name })}
                            disabled={index === 0}
                            onClick={() => move(index, index - 1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={t('moveDown', { place: stop.name })}
                            disabled={index === stops.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      {next ? (
                        <div className={styles.leg}>
                          <span aria-hidden="true" />
                          <small>
                            {stop.legMode ? (
                              <>
                                <span aria-hidden="true">{LEG_ICONS[stop.legMode]} </span>
                                {t(`legModes.${stop.legMode}`)} ·{' '}
                              </>
                            ) : null}
                            {t('crow', { km: number.format(Math.round(distanceKm(stop, next))) })}
                          </small>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className={styles.empty}>
                <strong>{t('emptyTitle')}</strong>
                <p>{t('emptyCopy')}</p>
                <button type="button" onClick={sample}>
                  {t('japanRoute')}
                </button>
              </div>
            )}
            <p className={styles.muted}>{t('addHint')}</p>
            {stops.length ? (
              <button type="button" className={styles.clear} onClick={() => commit([])}>
                {t('clearRoute')}
              </button>
            ) : null}
          </div>
        )}

        <div className={styles.panelFoot}>
          <Link href="/app/days" className={styles.cta}>
            {t('cta')} <span aria-hidden="true">→</span>
          </Link>
          <span className={styles.saveStatus} role="status" aria-live="polite">
            {saveStatus}
          </span>
        </div>
      </section>

      {toast ? (
        <div
          className={styles.toast}
          role="status"
          style={phone ? { bottom: sheetHeight + 84 } : undefined}
        >
          <span>{toast.text}</span>
          {toast.undo ? (
            <button type="button" onClick={undo}>
              {t('undo')}
            </button>
          ) : null}
        </div>
      ) : null}

      {visa ? <VisaOverlay visa={visa} onClose={() => setVisa(null)} /> : null}
    </div>
  );
}
