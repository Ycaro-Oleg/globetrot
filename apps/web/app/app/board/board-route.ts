import {
  DEFAULT_SPOT_KIND,
  distanceKm,
  spotKindOf,
  LEG_MODES,
  MEDIA_ALT_MAX,
  STOP_PHOTOS_MAX,
  STOP_ITEM_TEXT_MAX_LENGTH,
  STOP_SPOTS_MAX,
  STOP_TODOS_MAX,
  SPOT_KINDS,
  type LegMode,
  type SpotKind,
} from '@globetrot/domain';

export { DEFAULT_SPOT_KIND, SPOT_KINDS, type SpotKind };

/** A place on the map, as the board shows it. */
export type MapPlace = {
  id: string;
  name: string;
  countryCode: string;
  region: string;
  longitude: number;
  latitude: number;
};

export type StopSpot = {
  name: string;
  /** What it is, for its mini-pin: stay, food, sight, shop, transport or other. */
  kind: SpotKind;
  latitude: number | null;
  longitude: number | null;
  done: boolean;
};
export type StopTodo = { text: string; done: boolean };

/** The mini-pin's mark for each kind of spot (decoration: the kind is also said in words). */
export const SPOT_ICONS: Record<SpotKind, string> = {
  stay: '🛏',
  food: '🍽',
  sight: '📍',
  shop: '🛍',
  transport: '🚉',
  other: '✳',
};

/** A sensible kind for a point of interest from the map tiles (the domain's rule). */
export { spotKindOf };
/** A photo of the stop: an image the person uploaded and the words that describe it. */
/** A stop's photo: an upload (`mediaId`), or, only in the landing's demo, a static image with its credit. */
export type StopPhoto = { mediaId: string; alt: string; src?: string; credit?: string };

/** A stop on the board: the place, the nights, the person's own notes and lists, and how they reach the next. */
export type RouteStop = MapPlace & {
  nights: number;
  note: string;
  legMode: LegMode | null;
  visited: boolean;
  /** The route between this stop's placed spots is drawn: A, B, C… in the order of `spots`. */
  spotRoute: boolean;
  spots: StopSpot[];
  todos: StopTodo[];
  photos: StopPhoto[];
};

/** The pin card's tabs, in petal order. */
export const KIT_TABS = ['photos', 'spots', 'notes', 'todos'] as const;
export type KitTab = (typeof KIT_TABS)[number];

export const MAX_NIGHTS = 365;
export const NOTE_MAX = 500;
export const ITEM_MAX = STOP_ITEM_TEXT_MAX_LENGTH;
export const SPOTS_MAX = STOP_SPOTS_MAX;
export const TODOS_MAX = STOP_TODOS_MAX;
export const PHOTOS_MAX = STOP_PHOTOS_MAX;
/** How many changes Undo remembers. */
export const HISTORY_LIMIT = 50;

export const isLegMode = (value: unknown): value is LegMode =>
  typeof value === 'string' && (LEG_MODES as readonly string[]).includes(value);

export const newStop = (place: MapPlace): RouteStop => ({
  ...place,
  nights: 1,
  note: '',
  legMode: null,
  visited: false,
  spotRoute: false,
  spots: [],
  todos: [],
  photos: [],
});

/** Moves the stop at `from` to `to` (both clamped). Returns a copy, unchanged when nothing moves. */
export function moveStop<T>(stops: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(stops.length - 1, to));
  if (from === target || from < 0 || from >= stops.length) return [...stops];
  const next = [...stops];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

const clip = (text: string, max: number) => text.trim().slice(0, max);

/** What the API stores for one stop. The last stop has no leg (there is no next stop to reach). */
export function toDestination(stop: RouteStop, isLast: boolean) {
  return {
    placeKey: stop.id.slice(0, 200),
    name: clip(stop.name, 200) || stop.id.slice(0, 200),
    countryCode: /^[A-Z]{2}$/.test(stop.countryCode) ? stop.countryCode : null,
    region: clip(stop.region, 200) || null,
    latitude: stop.latitude,
    longitude: stop.longitude,
    nights: stop.nights,
    note: clip(stop.note, NOTE_MAX) || null,
    legMode: isLast ? null : stop.legMode,
    visited: stop.visited,
    spotRoute: stop.spotRoute,
    spots: stop.spots
      .map((spot) => ({ ...spot, name: clip(spot.name, ITEM_MAX) }))
      .filter((spot) => spot.name)
      .slice(0, SPOTS_MAX),
    todos: stop.todos
      .map((todo) => ({ ...todo, text: clip(todo.text, ITEM_MAX) }))
      .filter((todo) => todo.text)
      .slice(0, TODOS_MAX),
    photos: stop.photos
      .slice(0, PHOTOS_MAX)
      .map((photo) => ({ mediaId: photo.mediaId, alt: clip(photo.alt, MEDIA_ALT_MAX) })),
  };
}

/** A stop as the API answers it (`GET /v1/trips/{id}/destinations`), the fields the board reads. */
export type ApiDestination = {
  placeKey: string;
  name: string;
  countryCode?: string | null;
  region?: string | null;
  longitude: number;
  latitude: number;
  nights: number;
  note?: string | null;
  legMode?: string | null;
  visited?: boolean;
  spotRoute?: boolean;
  spots?: readonly (Omit<StopSpot, 'kind'> & { kind?: SpotKind })[];
  todos?: readonly StopTodo[];
  photos?: readonly StopPhoto[];
};

/** The board's stop for a stop the API answered: its place key is the board's id. */
export const fromDestination = (stop: ApiDestination): RouteStop => ({
  id: stop.placeKey,
  name: stop.name,
  countryCode: stop.countryCode ?? '',
  region: stop.region ?? '',
  longitude: stop.longitude,
  latitude: stop.latitude,
  nights: stop.nights,
  note: stop.note ?? '',
  legMode: isLegMode(stop.legMode) ? stop.legMode : null,
  visited: stop.visited ?? false,
  spotRoute: stop.spotRoute ?? false,
  spots: (stop.spots ?? []).map((spot) => ({ ...spot, kind: spot.kind ?? DEFAULT_SPOT_KIND })),
  todos: (stop.todos ?? []).map((todo) => ({ ...todo })),
  photos: (stop.photos ?? []).map((photo) => ({ ...photo })),
});

export const routeBody = (stops: readonly RouteStop[]) =>
  JSON.stringify(stops.map((stop, index) => toDestination(stop, index === stops.length - 1)));

/** Great-circle distance in kilometres ("as the crow flies"). */
/** As the crow flies, from the domain (one formula for the whole app). */
export { distanceKm };

const toMercator = (lng: number, lat: number) => {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const s = Math.sin((clamped * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)] as const;
};
const fromMercator = (x: number, y: number) =>
  [x * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI] as const;

/**
 * A gentle arc between two places, drawn as a quadratic curve in Mercator space (so it looks the same at every
 * zoom). It always bows "up" on the map. Returns `steps + 1` [lng, lat] points, from `a` to `b`.
 */
export function arcBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  steps = 64,
): [number, number][] {
  const [ax, ay] = toMercator(a.longitude, a.latitude);
  const [bx, by] = toMercator(b.longitude, b.latitude);
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy) || 1e-9;
  let nx = -dy / length;
  let ny = dx / length;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (ax + bx) / 2 + nx * length * 0.2;
  const cy = (ay + by) / 2 + ny * length * 0.2;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const [lng, lat] = fromMercator(
      u * u * ax + 2 * u * t * cx + t * t * bx,
      u * u * ay + 2 * u * t * cy + t * t * by,
    );
    points.push([lng, lat]);
  }
  return points;
}

/** The first `share` (0..1) of a line, cut at an interpolated point: how a new leg "draws in". */
export function partialLine(
  points: readonly [number, number][],
  share: number,
): [number, number][] {
  const f = Math.max(0, Math.min(1, share)) * (points.length - 1);
  const whole = Math.floor(f);
  const out = points.slice(0, whole + 1) as [number, number][];
  if (whole < points.length - 1) {
    const t = f - whole;
    const p = points[whole]!;
    const q = points[whole + 1]!;
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  if (out.length < 2) out.push(out[0]!);
  return out;
}

/** What the legend says the map shows at a zoom level (0 countries … 4 places). */
export const zoomLevel = (zoom: number) =>
  zoom < 3.2 ? 0 : zoom < 5.8 ? 1 : zoom < 10 ? 2 : zoom < 14.5 ? 3 : 4;

/** The first and last day at stop `index`, counted from the trip's start date (`YYYY-MM-DD`). */
export function stopDays(stops: readonly RouteStop[], index: number, startDate: string | null) {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const offset = stops.slice(0, index).reduce((sum, stop) => sum + stop.nights, 0);
  const [y, m, d] = startDate.split('-').map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d + offset));
  const end = new Date(Date.UTC(y, m - 1, d + offset + (stops[index]?.nights ?? 0)));
  return { start, end };
}

/** A keyboard shortcut should not steal keys from a field being typed in. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
