import { distanceKm, type LatLng } from '../geo/distance';
import type { SpotKind } from './destinations';

/** What the route between a stop's spots needs from a spot: maybe a place, maybe a kind. */
export interface RoutableSpot {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly kind?: SpotKind;
}

const placed = (spot: RoutableSpot) => spot.latitude !== null && spot.longitude !== null;
const onMap = <T extends RoutableSpot>(spots: readonly T[]) =>
  spots.filter((spot): spot is T & LatLng => placed(spot));

/**
 * The legs of a stop's spot route: A→B, B→C… between the spots that have a place, in their order, each with its
 * straight-line distance, and the total. Spots without a place are not on the route.
 */
export function spotLegs<T extends RoutableSpot>(
  spots: readonly T[],
): { legs: { from: T; to: T; km: number }[]; totalKm: number } {
  const route = onMap(spots);
  const legs = route.slice(1).map((to, index) => {
    const from = route[index]!;
    return { from, to, km: distanceKm(from, to) };
  });
  return { legs, totalKm: legs.reduce((sum, leg) => sum + leg.km, 0) };
}

/**
 * A short order for a stop's spots: starting where the person sleeps (the first `stay`, else the first spot with a
 * place), then always the nearest spot not visited yet. A quick, honest suggestion (not the perfect tour), kept
 * as straight lines. Spots without a place keep their order, after the route.
 */
export function shortestSpotOrder<T extends RoutableSpot>(spots: readonly T[]): T[] {
  const route = onMap(spots);
  const rest = spots.filter((spot) => !placed(spot));
  if (route.length < 2) return [...route, ...rest];
  const startAt = Math.max(
    0,
    route.findIndex((spot) => spot.kind === 'stay'),
  );
  const left = [...route];
  const ordered = left.splice(startAt, 1);
  while (left.length) {
    const here = ordered[ordered.length - 1]!;
    let best = 0;
    for (let index = 1; index < left.length; index++) {
      if (distanceKm(here, left[index]!) < distanceKm(here, left[best]!)) best = index;
    }
    ordered.push(...left.splice(best, 1));
  }
  return [...(ordered as T[]), ...rest];
}
