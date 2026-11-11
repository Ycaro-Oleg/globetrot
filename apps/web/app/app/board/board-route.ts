import { LEG_MODES, type LegMode } from '@globetrot/domain';
import type { MapPlace } from './map-canvas';

/** A stop on the board: the place, the nights, the person's note and how they reach the next stop. */
export type RouteStop = MapPlace & { nights: number; note: string; legMode: LegMode | null };

export const MAX_NIGHTS = 365;
export const NOTE_MAX = 500;
/** How many changes Undo remembers. */
export const HISTORY_LIMIT = 50;

export const isLegMode = (value: unknown): value is LegMode =>
  typeof value === 'string' && (LEG_MODES as readonly string[]).includes(value);

/** Moves the stop at `from` to `to` (both clamped). Returns the same array when nothing moves. */
export function moveStop<T>(stops: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(stops.length - 1, to));
  if (from === target || from < 0 || from >= stops.length) return [...stops];
  const next = [...stops];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** What the API stores for one stop. The last stop has no leg (there is no next stop to reach). */
export function toDestination(stop: RouteStop, isLast: boolean) {
  return {
    placeKey: stop.id.slice(0, 200),
    name: stop.name.trim().slice(0, 200) || stop.id.slice(0, 200),
    countryCode: /^[A-Z]{2}$/.test(stop.countryCode) ? stop.countryCode : null,
    region: stop.region.trim().slice(0, 200) || null,
    latitude: stop.latitude,
    longitude: stop.longitude,
    nights: stop.nights,
    note: stop.note.trim().slice(0, NOTE_MAX) || null,
    legMode: isLast ? null : stop.legMode,
  };
}

export const routeBody = (stops: readonly RouteStop[]) =>
  JSON.stringify(stops.map((stop, index) => toDestination(stop, index === stops.length - 1)));

/** The legs between consecutive stops, for the map. */
export function legsOf(stops: readonly RouteStop[]) {
  return stops.slice(0, -1).map((stop, index) => ({
    from: stop,
    to: stops[index + 1]!,
    mode: stop.legMode,
  }));
}

/** A keyboard shortcut should not steal Ctrl+Z from a field being typed in. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export const LEG_ICONS: Record<LegMode, string> = {
  flight: '✈',
  train: '🚆',
  bus: '🚌',
  car: '🚗',
  boat: '⛴',
  walk: '🚶',
  other: '•',
};
