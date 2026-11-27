'use client';

import { LEG_MODES, type LegMode } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  distanceKm,
  HISTORY_LIMIT,
  isEditable,
  ITEM_MAX,
  KIT_TABS,
  MAX_NIGHTS,
  moveStop,
  newStop,
  routeBody,
  SPOTS_MAX,
  stopDays,
  zoomLevel,
  type KitTab,
  type SpotKind,
  type MapPlace,
  type RouteStop,
  type StopSpot,
  fromDestination,
  type ApiDestination,
} from './board-route';
import type { PipFill, PipSpotChange } from './pin-card';
import { NO_PARTNERS, type Partners } from '../../../lib/partners';
import {
  MapCanvas,
  type BoardMapController,
  type Inset,
  type MapStop,
  type NearbyPlace,
} from './map-canvas';
import { MAP_STYLES, SWATCHES, type MapStyleName } from './map-styles';
import { kitCounts, PinCard } from './pin-card';
import { AskPipLink } from '../_components/ask-pip-link';
import { VisaOverlay, type StampedVisa } from './visa-overlay';
import { LegIcon } from './leg-icon';
import styles from './world-map.module.css';
import { isPlanRequired, PLAN_REQUIRED_PATH } from '../../../lib/plan-required';

/** Public browser key: map tiles only. Place search goes through the API (`/v1/places/*`), key on the server. */
const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
const NO_PENCILLED_SPOTS: { name: string; kind: SpotKind; latitude: number; longitude: number }[] =
  [];
const STYLE_KEY = 'globetrot.mapStyle';
/** Set once the person has opened a pin's card: the first-visit hint over the first pin stops showing. */
const PIN_HINT_KEY = 'globetrot.board.pinHint';
const DRAWER_KEY = 'globetrot.board.drawer';
/** What the closed drawer still takes on the right: its tab. */
const DRAWER_CLOSED_INSET = 72;
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
      ['Senso-ji', 139.7967, 35.7148, 'sight'],
      ['Shibuya Crossing', 139.7005, 35.6595, 'sight'],
      ['teamLab Planets', 139.7845, 35.6491, 'sight'],
    ],
  },
  {
    key: 'hakone',
    region: 'Kanagawa',
    longitude: 139.1069,
    latitude: 35.2324,
    nights: 1,
    spots: [
      ['Lake Ashi', 139.0235, 35.2045, 'sight'],
      ['Hakone Open-Air Museum', 139.0517, 35.2449, 'sight'],
    ],
  },
  {
    key: 'kyoto',
    region: 'Kyoto',
    longitude: 135.7588,
    latitude: 34.9858,
    nights: 4,
    spots: [
      ['Fushimi Inari', 135.7727, 34.9671, 'sight'],
      ['Kiyomizu-dera', 135.785, 34.9949, 'sight'],
      ['Gion', 135.7752, 35.0037, 'sight'],
    ],
  },
  {
    key: 'osaka',
    region: 'Osaka',
    longitude: 135.4959,
    latitude: 34.7025,
    nights: 2,
    spots: [
      ['Dotonbori', 135.5013, 34.6687, 'food'],
      ['Osaka Castle', 135.5262, 34.6873, 'sight'],
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

const NO_PENCILLED: PipSuggestion['stops'] = [];

export interface PipSuggestion {
  readonly count: number;
  readonly stops: readonly {
    readonly name: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly nights: number;
  }[];
}

export function WorldMapBoard({
  tripId,
  tripTitle,
  startDate,
  initialRoute,
  initialVisas,
  pipEnabled = false,
  pipSuggestion = null,
  home = null,
  demo = false,
  partners = NO_PARTNERS,
}: {
  /** The trip the route belongs to, or `null` when there is no trip yet (the board then works unsaved). */
  tripId: string | null;
  tripTitle: string | null;
  startDate: string | null;
  initialRoute: RouteStop[];
  /** Countries with a commemorative visa already. */
  initialVisas: string[];
  pipEnabled?: boolean;
  /** Pip's proposal waiting for a decision: how many changes, and the new stops to pencil on the map. */
  pipSuggestion?: PipSuggestion | null;
  /** The person's home city, when it has a point: where the trip starts on the map. */
  home?: { name: string; latitude: number; longitude: number } | null;
  /**
   * The landing's live demo: the board fills its box (not the window), search asks to sign up, photos are only
   * shown, nothing is saved or remembered, and the map leaves the page's scrolling alone.
   */
  demo?: boolean;
  /** Partner ids for the pin card's partner links (ADR-0031); none by default. */
  partners?: Partners;
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
  /** Where the card lives: next to its pin, where the person dragged it, or expanded into a tall side panel. */
  const [cardMode, setCardMode] = useState<'follow' | 'moved' | 'expanded'>('follow');
  const [layersOpen, setLayersOpen] = useState(false);
  const [pinHint, setPinHint] = useState<{ x: number; y: number } | null>(null);
  const [pinHintSeen, setPinHintSeen] = useState(true);
  /** "Mark on the map" from a card: the next tap on the map places this spot instead of adding a stop. */
  const [spotPin, setSpotPin] = useState<{ stopId: string; name: string; kind: SpotKind } | null>(
    null,
  );
  /**
   * "Pip, suggest places": what Pip offered for one stop's card (only real places from this map), which of them
   * the person keeps, and where the request stands.
   */
  const [pipFill, setPipFill] = useState<PipFill | null>(null);
  // Pip's offers on the map, kept stable between renders (the map redraws its mini-pins when they change).
  const pencilledSpots = useMemo(
    () =>
      pipFill?.state === 'ready'
        ? pipFill.changes
            .filter((_, index) => pipFill.picked.includes(index))
            .map((change) => ({
              name: change.name,
              kind: change.spotKind,
              latitude: change.latitude,
              longitude: change.longitude,
            }))
        : NO_PENCILLED_SPOTS,
    [pipFill],
  );
  /** A spot whose mini-pin was tapped, brought into view in its card. */
  const [focusSpot, setFocusSpot] = useState<{ stopId: string; index: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const controller = useRef<BoardMapController | null>(null);
  const nearbyTimer = useRef(0);
  const selectedRef = useRef<string | null>(null);

  const selectedIndex = stops.findIndex((stop) => stop.id === selected);
  const active = selectedIndex >= 0 ? stops[selectedIndex]! : null;
  const cardIndex = card ? stops.findIndex((stop) => stop.id === card.id) : -1;
  const cardStop = cardIndex >= 0 ? stops[cardIndex]! : null;
  const phone = view.phone;
  // The route panel is a drawer on a computer: it folds away to give the map the whole width.
  const [drawerOpen, setDrawerOpen] = useState(true);
  const drawerClosed = !phone && !drawerOpen;
  const panelInset = phone ? 0 : drawerOpen ? PANEL_INSET : DRAWER_CLOSED_INSET;
  const toggleDrawer = useCallback(
    (open: boolean) => {
      setDrawerOpen(open);
      if (demo) return;
      try {
        window.localStorage.setItem(DRAWER_KEY, open ? 'open' : 'closed');
      } catch {
        /* The choice just is not remembered. */
      }
    },
    [demo],
  );
  useEffect(() => {
    if (demo) return;
    const frame = requestAnimationFrame(() => {
      try {
        if (window.localStorage.getItem(DRAWER_KEY) === 'closed') setDrawerOpen(false);
      } catch {
        /* Opens as usual. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [demo]);
  const searchActive = query.trim().length >= 2;

  // The card sits next to its pin and follows the map; on a phone it opens full width at the top.
  const placeCard = useCallback(() => {
    if (!cardStop) return;
    const width = stage.current?.clientWidth ?? view.w;
    const height = view.stageH;
    if (cardMode === 'moved') return; // Stays where the person put it.
    if (cardMode === 'expanded') {
      setCardStyle(
        phone
          ? { left: 12, top: 12, width: width - 24, maxHeight: Math.round(height * 0.86) }
          : { left: 16, top: 72, width: 440, maxHeight: height - 88, height: height - 88 },
      );
      return;
    }
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
    if (left + 340 > width - panelInset) left = point.x - 36 - 340;
    left = Math.max(12, left);
    const top = Math.max(72, Math.min(height - maxHeight - 14, point.y - 150));
    setCardStyle({ left, top, width: 340, maxHeight });
  }, [cardStop, cardMode, phone, view.w, view.stageH, panelInset]);
  useEffect(() => {
    const frame = requestAnimationFrame(placeCard);
    return () => cancelAnimationFrame(frame);
  }, [placeCard]);

  // The first-visit hint over the first pin: read after the first paint, then kept next to that pin.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setPinHintSeen(window.localStorage.getItem(PIN_HINT_KEY) === '1');
      } catch {
        setPinHintSeen(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const firstStop = stops[0] ?? null;
  const placePinHint = useCallback(() => {
    // On a phone the stops are listed in the sheet below and the toolbar fills the top: no bubble there.
    if (pinHintSeen || !firstStop || card || phone) return setPinHint(null);
    const point = controller.current?.project(firstStop.longitude, firstStop.latitude);
    if (!point) return setPinHint(null);
    // Kept clear of the route panel and the screen edges (the bubble is 300px wide, centred on the pin).
    const width = stage.current?.clientWidth ?? view.w;
    const right = width - panelInset - 160;
    setPinHint({ x: Math.min(Math.max(160, point.x), Math.max(160, right)), y: point.y });
  }, [pinHintSeen, firstStop, card, phone, view.w, panelInset]);
  useEffect(() => {
    const frame = requestAnimationFrame(placePinHint);
    return () => cancelAnimationFrame(frame);
  }, [placePinHint]);
  // A window resized (or the drawer folded) with no stop open keeps the whole route in view, clear of the panel.
  const sized = useRef<string | null>(null);
  useEffect(() => {
    const size = `${view.w}x${view.h}x${panelInset}`;
    const previous = sized.current;
    sized.current = size;
    if (previous === null || previous === size || selected) return;
    const timer = window.setTimeout(() => controller.current?.fitStops(false), 200);
    return () => window.clearTimeout(timer);
  }, [view.w, view.h, panelInset, selected]);

  // The remembered style is read after the first paint, so the server and the browser render the same page.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStyleName(readStyle()));
    return () => cancelAnimationFrame(frame);
  }, []);

  // The board fills the space under the app's top bar (and above the phone's tab bar).
  useEffect(() => {
    const measure = () => {
      if (demo) {
        // The demo lives in a box on a scrolling page: its size is the box's.
        const box = stage.current?.getBoundingClientRect();
        const width = box?.width ?? window.innerWidth;
        const height = box?.height ?? 600;
        setView({ w: width, h: height, phone: width < PHONE_MAX, stageH: height });
        return;
      }
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
    const observer = demo && stage.current ? new ResizeObserver(measure) : null;
    if (observer && stage.current) observer.observe(stage.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [demo]);

  const sheetHeight = {
    peek: 150,
    half: Math.round(view.stageH * 0.5),
    full: Math.round(view.stageH * 0.88),
  }[sheet];
  const inset: Inset = phone
    ? { top: 76, right: 20, bottom: sheetHeight + 10, left: 20 }
    : // The layers and zoom dock sits in the lower left: keep pins (and home) above it.
      { top: 80, right: panelInset, bottom: 90, left: 40 };

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
        if (await isPlanRequired(response)) {
          // The free week is over: the change cannot be kept, so the plans come next (with the reason).
          window.location.assign(PLAN_REQUIRED_PATH);
          return;
        }
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
    if (text.length < 2 || demo) return;
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
  }, [query, locale, demo]);

  const select = useCallback(
    (id: string | null) => {
      selectedRef.current = id;
      setSelected(id);
      setNearby(null);
      window.clearTimeout(nearbyTimer.current);
      if (!id) return;
      const stop = stops.find((candidate) => candidate.id === id);
      if (!stop) return;
      // Opening a stop shows it in the drawer, so a folded drawer comes back.
      setDrawerOpen(true);
      if (phone && sheet === 'peek') setSheet('half');
      controller.current?.flyTo(stop.longitude, stop.latitude);
      // "Nearby" reads the points of interest drawn once the map has settled there.
      // The settled read always wins; the fallback timer only fills in when nothing was read yet.
      const read = (settled: boolean) => {
        if (selectedRef.current !== id) return;
        const places = controller.current?.nearby(stop.longitude, stop.latitude, locale) ?? [];
        setNearby((current) => (!settled && current?.id === id ? current : { id, places }));
      };
      controller.current?.onceIdle(() => read(true));
      // A fly to where the map already is fires no "moveend": read after a while anyway.
      nearbyTimer.current = window.setTimeout(() => read(false), 4000);
    },
    [stops, phone, sheet, locale],
  );

  /** Reads the route back from the server after Pip changed it, so the board shows it and does not save over it. */
  const reloadRoute = async () => {
    if (!tripId) return;
    const response = await fetch(`/v1/trips/${tripId}/destinations`).catch(() => null);
    const json = (await response?.json().catch(() => null)) as {
      destinations?: ApiDestination[];
    } | null;
    if (!response?.ok || !json?.destinations) return;
    const route = json.destinations.map(fromDestination);
    setStops(route);
    setSavedBody(routeBody(route));
  };

  const askPipFill = async (stop: RouteStop) => {
    if (!tripId) return;
    const places = (nearby?.id === stop.id ? nearby.places : []).slice(0, 40).map((place) => ({
      name: place.name.slice(0, 120),
      kind: place.kind.slice(0, 40),
      latitude: place.latitude,
      longitude: place.longitude,
    }));
    const base = { placeKey: stop.id, proposalId: null, changes: [], picked: [] };
    if (!places.length) return setPipFill({ ...base, state: 'error', error: 'NO_PLACES' });
    // The route must be saved first: Pip reads the stop from the server.
    if (unsaved) return setPipFill({ ...base, state: 'error', error: 'SAVING' });
    setPipFill({ ...base, state: 'asking', error: null });
    const response = await fetch(`/v1/trips/${tripId}/pip/proposals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        request: t('pip.fillRequest', { place: stop.name }),
        spotCandidates: { placeKey: stop.id, places },
      }),
    }).catch(() => null);
    const json = (await response?.json().catch(() => null)) as {
      id?: string;
      code?: string;
      changes?: { kind: string }[];
    } | null;
    if (!response?.ok || !json?.id) {
      const code = json?.code ?? '';
      const known = ['RATE_LIMITED', 'OUT_OF_CREDITS', 'PLAN_REQUIRED', 'SERVICE_UNAVAILABLE'];
      return setPipFill({
        ...base,
        state: 'error',
        error: known.includes(code) ? code : response ? 'UNKNOWN' : 'SERVICE_UNAVAILABLE',
      });
    }
    const changes = (json.changes ?? []).filter(
      (change): change is PipSpotChange => change.kind === 'addSpot',
    );
    setPipFill({
      ...base,
      proposalId: json.id,
      changes,
      picked: changes.map((_, index) => index),
      state: changes.length ? 'ready' : 'empty',
      error: null,
    });
  };

  const decidePipFill = async (action: 'apply' | 'discard' | 'undo') => {
    const fill = pipFill;
    if (!fill?.proposalId) return setPipFill(null);
    const response = await fetch(`/v1/pip/proposals/${fill.proposalId}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      ...(action === 'apply' ? { body: JSON.stringify({ include: fill.picked }) } : {}),
    }).catch(() => null);
    if (!response?.ok) return setPipFill({ ...fill, state: 'error', error: 'UNKNOWN' });
    if (action === 'discard') return setPipFill(null);
    await reloadRoute();
    if (action === 'apply') {
      setPipFill({ ...fill, state: 'applied' });
      flash(t('pip.fillApplied', { count: fill.picked.length }));
    } else {
      setPipFill(null);
      flash(t('pip.fillUndone'));
    }
  };

  const openCard = useCallback(
    (id: string, tab: KitTab | null) => {
      if (selected !== id) select(id);
      if (card?.id !== id) setCardMode('follow');
      setCard((current) => ({ id, tab: tab ?? current?.tab ?? 'spots' }));
      // The first pin's hint has done its job.
      setPinHintSeen(true);
      try {
        window.localStorage.setItem(PIN_HINT_KEY, '1');
      } catch {
        /* Not remembered: it shows again next time. */
      }
    },
    [selected, select, card?.id],
  );

  /** Drags the card by its title bar (a mouse or pen extra: Expand and Close are buttons). */
  const dragCard = (event: ReactPointerEvent<HTMLElement>) => {
    if (phone || cardMode === 'expanded' || event.button !== 0) return;
    const card = event.currentTarget.closest('[data-pin-card]')?.getBoundingClientRect();
    const box = stage.current?.getBoundingClientRect();
    if (!card || !box) return;
    event.preventDefault();
    const dx = event.clientX - card.left;
    const dy = event.clientY - card.top;
    const onMove = (move: PointerEvent) => {
      const left = Math.min(Math.max(8, move.clientX - box.left - dx), box.width - card.width - 8);
      const top = Math.min(Math.max(8, move.clientY - box.top - dy), box.height - 64);
      setCardMode('moved');
      setCardStyle((current) => ({ ...current, left, top }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
    if (spotPin) {
      // Placing a spot from its card: a mini-pin in that city, not a new stop.
      const target = spotPin;
      const spotName = (target.name || name || t('card.pinnedSpot')).slice(0, ITEM_MAX);
      commit((current) =>
        current.map((stop) =>
          stop.id === target.stopId && stop.spots.length < SPOTS_MAX
            ? {
                ...stop,
                spots: [
                  ...stop.spots,
                  { name: spotName, kind: target.kind, latitude, longitude, done: false },
                ],
              }
            : stop,
        ),
      );
      setSpotPin(null);
      setTool('select');
      flash(t('spotPinned', { name: spotName }));
      return;
    }
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
          spots: item.spots.map(([name, longitude, latitude, kind]): StopSpot => ({
            name,
            kind,
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
        else if (spotPin) {
          setSpotPin(null);
          setTool('select');
        } else if (card) setCard(null);
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
      if (event.key === 'v' || event.key === 'V') {
        setTool('select');
        setSpotPin(null);
      } else if (event.key === 'p' || event.key === 'P') {
        setTool('pin');
        setSpotPin(null);
        if (phone) setSheet('peek');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visa, card, tool, selected, undo, phone, spotPin]);

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
  const saveStatus = demo ? null : tripId === null ? (
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
      data-drawer={drawerClosed ? 'closed' : undefined}
      data-demo={demo || undefined}
      style={
        {
          height: demo ? undefined : view.stageH || undefined,
          '--panel-inset': `${panelInset}px`,
        } as CSSProperties
      }
    >
      <MapCanvas
        stops={mapStops}
        pencilled={pipSuggestion?.stops ?? NO_PENCILLED}
        pencilledSpots={pencilledSpots}
        home={home}
        selectedId={selected}
        styleName={styleName}
        locale={locale}
        tool={tool}
        visitedCountries={visited}
        inset={inset}
        phone={phone}
        apiKey={API_KEY}
        cooperative={
          demo ? { windows: t('coopWindows'), mac: t('coopMac'), mobile: t('coopMobile') } : null
        }
        controllerRef={controller}
        text={{
          map: t('mapLabel'),
          loading: t('mapLoading'),
          error: t('mapError'),
          petal: petalNames,
          stop: (name, index) => t('stopAria', { place: name, index }),
          tip: (name) => t('pinTip', { place: name }),
          spot: (name, kind, place) =>
            t('spotAria', { name, kind: t(`card.kinds.${kind}`), place }),
          items: (count) => t('pinItems', { count }),
          pencilled: (name) => t('pip.pencilled', { name }),
          home: (name) => t('home', { name }),
        }}
        onSelect={select}
        onOpenCard={openCard}
        onOpenSpot={(stopId, index) => {
          openCard(stopId, 'spots');
          setFocusSpot({ stopId, index });
        }}
        onPin={pinAt}
        onZoom={(value) =>
          setZoom((current) => (Math.abs(current - value) > 0.15 ? value : current))
        }
        onMove={() => {
          if (card) placeCard();
          if (!pinHintSeen) placePinHint();
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
              {demo ? (
                <p>
                  {t('demoSearch')} <Link href="/signup">{t('demoSearchLink')}</Link>
                </p>
              ) : searchError === 'busy' ? (
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
                setSpotPin(null);
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
          {spotPin
            ? t('spotPinHint', {
                name: spotPin.name || t(`card.kinds.${spotPin.kind}`),
                place: stops.find((stop) => stop.id === spotPin.stopId)?.name ?? '',
              })
            : phone
              ? t('pinHintPhone')
              : t('pinHint')}
        </div>
      ) : null}

      <div className={styles.dock}>
        {!phone && !layersOpen ? (
          <button
            type="button"
            className={styles.layersButton}
            aria-expanded={false}
            aria-controls="map-layers"
            onClick={() => setLayersOpen(true)}
          >
            <span className={styles.swatch} aria-hidden="true">
              {SWATCHES[styleName].map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </span>
            {t('layers')}
          </button>
        ) : null}
        {!phone && layersOpen ? (
          <div className={styles.legend} id="map-layers">
            <div className={styles.legendRow}>
              <span className={styles.kicker}>{t('layers')}</span>
              <button
                type="button"
                className={styles.legendClose}
                aria-expanded={true}
                aria-controls="map-layers"
                onClick={() => setLayersOpen(false)}
              >
                {t('layersClose')}
              </button>
            </div>
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

      {pinHint && tool !== 'pin' ? (
        <div className={styles.pinHint} style={{ left: pinHint.x, top: pinHint.y }} role="status">
          <span>{t('pinHintFirst')}</span>
          <button
            type="button"
            onClick={() => {
              setPinHintSeen(true);
              try {
                window.localStorage.setItem(PIN_HINT_KEY, '1');
              } catch {
                /* Shows again next time. */
              }
            }}
          >
            {t('pinHintOk')}
          </button>
        </div>
      ) : null}

      {cardStop ? (
        <PinCard
          key={cardStop.id}
          partners={partners}
          stop={cardStop}
          index={cardIndex}
          name={cardStop.name}
          when={when(cardIndex)}
          tab={card!.tab}
          style={cardStyle}
          expanded={cardMode === 'expanded'}
          onToggleExpand={() => {
            // On a phone the route sheet steps down to make room for the expanded card.
            if (phone && cardMode !== 'expanded') setSheet('peek');
            setCardMode((current) => (current === 'expanded' ? 'follow' : 'expanded'));
          }}
          onDragStart={dragCard}
          nearby={nearby?.id === cardStop.id ? nearby.places : null}
          photosReadOnly={demo}
          focusSpot={focusSpot?.stopId === cardStop.id ? focusSpot.index : null}
          pip={
            pipEnabled && tripId
              ? {
                  fill: pipFill?.placeKey === cardStop.id ? pipFill : null,
                  onAsk: () => void askPipFill(cardStop),
                  onToggle: (index) =>
                    setPipFill((current) =>
                      current
                        ? {
                            ...current,
                            picked: current.picked.includes(index)
                              ? current.picked.filter((other) => other !== index)
                              : [...current.picked, index].sort((a, b) => a - b),
                          }
                        : current,
                    ),
                  onApply: () => void decidePipFill('apply'),
                  onDiscard: () => void decidePipFill('discard'),
                  onUndo: () => void decidePipFill('undo'),
                }
              : null
          }
          onShowRoute={(points) => {
            // The card steps aside so the route shows whole: docked on the left, or closed on a phone.
            if (phone) {
              setCard(null);
              setCardStyle({ visibility: 'hidden' });
              controller.current?.fitPoints(points);
            } else {
              setCardMode('expanded');
              controller.current?.fitPoints(points, 470);
            }
          }}
          onPinSpot={(draft) => {
            setSpotPin({ stopId: cardStop.id, ...draft });
            setTool('pin');
            if (phone) setSheet('peek');
          }}
          onTab={(tab) => setCard({ id: cardStop.id, tab })}
          onChange={(change) => updateStop(cardStop.id, change)}
          onShowSpot={(spot) =>
            spot.longitude !== null &&
            spot.latitude !== null &&
            controller.current?.flyTo(spot.longitude, spot.latitude, 16)
          }
          onClose={() => {
            setCard(null);
            setCardMode('follow');
            setCardStyle({ visibility: 'hidden' });
          }}
        />
      ) : null}

      {!phone ? (
        <button
          type="button"
          className={styles.drawerToggle}
          aria-expanded={drawerOpen}
          aria-controls="board-panel"
          onClick={() => toggleDrawer(!drawerOpen)}
        >
          <span aria-hidden="true">{drawerOpen ? '›' : '‹'}</span>
          {drawerOpen ? (
            <span className="sr-only">{t('drawerClose')}</span>
          ) : (
            <span>{t('drawerOpen', { count: stops.length })}</span>
          )}
        </button>
      ) : null}

      <section
        id="board-panel"
        className={styles.panel}
        inert={drawerClosed || undefined}
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
                    {{ photos: '▣', spots: '◎', notes: '✎', todos: '✓' }[tab]}
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
              <div className={styles.legRow}>
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
                <span aria-hidden="true">✓ </span>
                {active.visited ? t('visitedUndo') : t('markVisited')}
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
              {pipSuggestion ? (
                <div className={styles.pipNote}>
                  <span>
                    <strong>{t('pip.suggestionsTitle', { count: pipSuggestion.count })}</strong>
                    <small>{t('pip.suggestionsBody', { count: pipSuggestion.stops.length })}</small>
                  </span>
                  <Link href="/app/pip" className={styles.pipReview}>
                    {t('pip.review')} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : pipEnabled && tripId ? (
                <AskPipLink topic="board" tone="dark" />
              ) : null}
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
                                <LegIcon mode={stop.legMode} /> {t(`legModes.${stop.legMode}`)}{' '}
                                ·{' '}
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
            {stops.length ? (
              <button
                type="button"
                className={styles.addStop}
                onClick={() => {
                  // The search box is the main way to add a stop: take the person there, keyboard included.
                  if (phone) setSheet('peek');
                  document.getElementById('place-search')?.focus();
                }}
              >
                {t('addStop')}
              </button>
            ) : null}
            {stops.length ? null : <p className={styles.muted}>{t('addHint')}</p>}
            {stops.length ? (
              <button type="button" className={styles.clear} onClick={() => commit([])}>
                {t('clearRoute')}
              </button>
            ) : null}
          </div>
        )}

        <div className={styles.panelFoot}>
          <Link href={demo ? '/signup' : '/app/trip#itinerary'} className={styles.cta}>
            {demo ? t('demoCta') : t('cta')} <span aria-hidden="true">→</span>
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
