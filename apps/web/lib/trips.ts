import { createServerApiClient, type FetchOptions } from './stored-preferences';
import type { paths } from '@globetrot/api-client';

export type TripView =
  paths['/v1/trips']['get']['responses'][200]['content']['application/json']['trips'][number];

export const SELECTED_TRIP_COOKIE = 'globetrot.selected_trip';

export async function fetchTrips(
  options: FetchOptions,
  includeArchived = false,
): Promise<TripView[] | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/trips', {
      params: { query: { includeArchived: includeArchived ? 'true' : 'false' } },
    });
    return data?.trips ?? null;
  } catch {
    return null;
  }
}

export async function fetchTrip(options: FetchOptions, id: string): Promise<TripView | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/trips/{id}', {
      params: { path: { id } },
    });
    return data ?? null;
  } catch {
    return null;
  }
}
