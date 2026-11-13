'use server';

import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
import type { DayPlanData } from '../../../lib/trips';

async function apiClient() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  return cookieHeader ? createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
}

/** Each action answers with the whole plan after the change (or null when it did not work). */
type Result = DayPlanData | null;

export async function addPlace(
  tripId: string,
  input: { name: string; destinationId: string | null; minutes: number },
): Promise<Result> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.POST('/v1/trips/{id}/day-places', {
    params: { path: { id: tripId } },
    body: input,
  });
  return data ?? null;
}

export async function movePlace(
  tripId: string,
  placeId: string,
  day: number | null,
  beforeId?: string,
): Promise<Result> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.PATCH('/v1/trips/{id}/day-places/{placeId}', {
    params: { path: { id: tripId, placeId } },
    body: { day, ...(beforeId ? { beforeId } : {}) },
  });
  return data ?? null;
}

export async function removePlace(tripId: string, placeId: string): Promise<Result> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.DELETE('/v1/trips/{id}/day-places/{placeId}', {
    params: { path: { id: tripId, placeId } },
  });
  return data ?? null;
}
