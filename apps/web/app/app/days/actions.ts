'use server';

import { actionApiClient } from '../../../lib/action-client';
import type { paths } from '@globetrot/api-client';
import type { DayPlanData } from '../../../lib/trips';

export type DayIdeas =
  paths['/v1/trips/{id}/day-ideas']['get']['responses'][200]['content']['application/json'];
export type DayIdea = DayIdeas['stops'][number]['ideas'][number];

const apiClient = actionApiClient;

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
