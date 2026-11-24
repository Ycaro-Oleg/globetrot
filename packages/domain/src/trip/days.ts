import { addDays, type LocalDate } from '../time';
import { InvalidTripError, type TripPlan, type TripStop } from './types';

export interface TripDay {
  /** 1-based day index across the whole trip. */
  readonly index: number;
  /** Calendar date, or `null` while the trip has no start date. */
  readonly date: LocalDate | null;
  readonly stopId: string;
  /** True on the first day at a stop ("arrive"). */
  readonly arrival: boolean;
  /** True on the last day: the person leaves (home or onward) that day, so only the morning is free. */
  readonly departure: boolean;
}

/** What the day rules read: the start date and the route. A full `TripPlan` fits. */
export type DayPlan = Pick<TripPlan, 'startDate' | 'stops'>;

export function plannedStops(trip: Pick<TripPlan, 'stops'>): TripStop[] {
  return trip.stops.filter((s) => s.state === 'planned');
}

/**
 * Days are consecutive from `startDate` across planned stops in route order: each night is one day, and the trip
 * ends with its departure day (the day after the last night), spent at the last stop slept in. Day trips (0 nights)
 * add no day of their own; a route of day trips only is one day. Draft stops are ignored, and no stop means no day.
 */
export function tripDays(trip: DayPlan): TripDay[] {
  const days: TripDay[] = [];
  const stops = plannedStops(trip);
  const dateOf = (index: number) =>
    trip.startDate === null ? null : addDays(trip.startDate, index - 1);
  let lastSlept: string | null = null;
  for (const stop of stops) {
    if (!Number.isSafeInteger(stop.nights) || stop.nights < 0) {
      throw new InvalidTripError(`Stop ${stop.id} has invalid nights: ${stop.nights}`);
    }
    for (let night = 0; night < stop.nights; night++) {
      const index = days.length + 1;
      days.push({
        index,
        date: dateOf(index),
        stopId: stop.id,
        arrival: night === 0,
        departure: false,
      });
    }
    if (stop.nights > 0) lastSlept = stop.id;
  }
  const last = stops.at(-1);
  if (last) {
    const index = days.length + 1;
    days.push({
      index,
      date: dateOf(index),
      stopId: lastSlept ?? last.id,
      arrival: lastSlept === null,
      departure: true,
    });
  }
  return days;
}

/**
 * Days with no scheduled place on any planned stop. The departure day is left out: it can hold places, but a trip
 * whose other days are planned does not need one there to count as planned.
 */
export function emptyDays(trip: TripPlan): TripDay[] {
  const scheduled = new Set<number>();
  for (const stop of plannedStops(trip)) {
    for (const place of stop.places) if (place.day !== null) scheduled.add(place.day);
  }
  return tripDays(trip).filter((d) => !d.departure && !scheduled.has(d.index));
}
