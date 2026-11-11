import { createServerApiClient, type FetchOptions } from './stored-preferences';
import type { paths } from '@globetrot/api-client';

export type TripView =
  paths['/v1/trips']['get']['responses'][200]['content']['application/json']['trips'][number];

export type DestinationView =
  paths['/v1/trips/{id}/destinations']['get']['responses'][200]['content']['application/json']['destinations'][number];

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

/** A trip's route in order, or `null` when it cannot be read. */
export async function fetchDestinations(
  options: FetchOptions,
  tripId: string,
): Promise<DestinationView[] | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/trips/{id}/destinations', {
      params: { path: { id: tripId } },
    });
    return data?.destinations ?? null;
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

export type BudgetData =
  paths['/v1/trips/{id}/budget']['get']['responses'][200]['content']['application/json'];
export type ExpenseData =
  paths['/v1/trips/{id}/expenses']['get']['responses'][200]['content']['application/json']['expenses'][number];

/** The totals and the savings answer of a trip, or `null` when they cannot be read. */
export async function fetchBudget(
  options: FetchOptions,
  tripId: string,
): Promise<BudgetData | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/trips/{id}/budget', {
      params: { path: { id: tripId } },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

/** A trip's costs, newest first, or `null` when they cannot be read. */
export async function fetchExpenses(
  options: FetchOptions,
  tripId: string,
): Promise<ExpenseData[] | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/trips/{id}/expenses', {
      params: { path: { id: tripId } },
    });
    return data?.expenses ?? null;
  } catch {
    return null;
  }
}
