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
}

/** What the day rules read: the start date and the route. A full `TripPlan` fits. */
export type DayPlan = Pick<TripPlan, 'startDate' | 'stops'>;

export function plannedStops(trip: Pick<TripPlan, 'stops'>): TripStop[] {
  return trip.stops.filter((s) => s.state === 'planned');
}

/**
 * Days are consecutive from `startDate` across planned stops in route order: each night is one day.
 * Day trips (0 nights) add no day. Draft stops are ignored.
 */
export function tripDays(trip: DayPlan): TripDay[] {
  const days: TripDay[] = [];
  for (const stop of plannedStops(trip)) {
    if (!Number.isSafeInteger(stop.nights) || stop.nights < 0) {
      throw new InvalidTripError(`Stop ${stop.id} has invalid nights: ${stop.nights}`);
    }
    for (let night = 0; night < stop.nights; night++) {
      const index = days.length + 1;
      days.push({
        index,
        date: trip.startDate === null ? null : addDays(trip.startDate, index - 1),
        stopId: stop.id,
        arrival: night === 0,
      });
    }
  }
  return days;
}

/** Days with no scheduled place on any planned stop. */
export function emptyDays(trip: TripPlan): TripDay[] {
  const scheduled = new Set<number>();
  for (const stop of plannedStops(trip)) {
    for (const place of stop.places) if (place.day !== null) scheduled.add(place.day);
  }
  return tripDays(trip).filter((d) => !scheduled.has(d.index));
}
