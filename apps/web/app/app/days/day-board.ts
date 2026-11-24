import type { TripDay } from '@globetrot/domain';

export interface BoardStop {
  readonly id: string;
  readonly name: string;
  readonly nights: number;
  /** How the person goes on to the next stop, if they said. */
  readonly legMode: string | null;
}

export interface BoardPlace {
  readonly id: string;
  readonly name: string;
  readonly minutes: number;
  readonly day: number | null;
  readonly destinationId: string | null;
}

/** More than this many hours in a day is a full day; fewer than `LIGHT_HOURS` is light (design handoff v2). */
export const FULL_HOURS = 9;
export const LIGHT_HOURS = 3;
/** The load bar is full at ten hours. */
export const LOAD_SCALE_HOURS = 10;

export interface BoardDay extends TripDay {
  readonly stop: BoardStop | null;
  readonly places: readonly BoardPlace[];
  readonly hours: number;
  readonly load: 'full' | 'light' | 'ok';
  /** On the first day at a stop after the first: the move from the previous stop. */
  readonly travel: { readonly mode: string; readonly from: string; readonly to: string } | null;
}

/** The day plan as the board shows it: "No day" first, then every day with its places, load and travel. */
export function buildBoard(
  days: readonly TripDay[],
  stops: readonly BoardStop[],
  places: readonly BoardPlace[],
): { tray: BoardPlace[]; days: BoardDay[]; totalHours: number; fullDays: number } {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const tray = places.filter((place) => place.day === null || place.day > days.length);
  let totalHours = 0;
  let fullDays = 0;
  const board = days.map((day) => {
    const stop = byId.get(day.stopId) ?? null;
    const onDay = places.filter((place) => place.day === day.index);
    const hours = onDay.reduce((sum, place) => sum + place.minutes, 0) / 60;
    totalHours += hours;
    const load = hours > FULL_HOURS ? 'full' : hours < LIGHT_HOURS ? 'light' : 'ok';
    if (load === 'full') fullDays++;
    const at = stops.findIndex((candidate) => candidate.id === day.stopId);
    const previous = day.arrival && at > 0 ? stops[at - 1] : undefined;
    return {
      ...day,
      stop,
      places: onDay,
      hours,
      load,
      travel:
        previous && stop
          ? { mode: previous.legMode ?? 'other', from: previous.name, to: stop.name }
          : null,
    } satisfies BoardDay;
  });
  return { tray, days: board, totalHours, fullDays };
}

/** Where a place lands when dropped on a card: on that card's day, just before it. */
export function dropTarget(
  placeId: string,
  target: { readonly day: number | null; readonly beforeId?: string | undefined },
): { day: number | null; beforeId?: string } | null {
  if (target.beforeId === placeId) return null;
  return target.beforeId ? { day: target.day, beforeId: target.beforeId } : { day: target.day };
}
