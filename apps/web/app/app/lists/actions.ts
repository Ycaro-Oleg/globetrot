'use server';

import { CHECKLIST_GROUPS, type ChecklistGroup } from '@globetrot/domain';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
import type { ChecklistData } from '../../../lib/trips';

async function apiClient() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  return cookieHeader ? createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
}

/** Each action answers with the lists and stamps after the change, or null when it did not work. */
type Result = ChecklistData | null;

export async function addItem(
  tripId: string,
  group: ChecklistGroup,
  label: string,
): Promise<Result> {
  const client = await apiClient();
  if (!client || !label.trim() || !CHECKLIST_GROUPS.includes(group)) return null;
  const { data } = await client.POST('/v1/trips/{id}/checklist', {
    params: { path: { id: tripId } },
    body: { items: [{ group, label: label.trim() }] },
  });
  return data ?? null;
}

/** Adds the suggested items, written in the language the person is using now. */
export async function addSuggestions(tripId: string): Promise<Result> {
  const client = await apiClient();
  if (!client) return null;
  const t = await getTranslations('listsPage.suggestions');
  const items = CHECKLIST_GROUPS.flatMap((group) =>
    Object.values(t.raw(group) as Record<string, string>).map((label) => ({ group, label })),
  );
  const { data } = await client.POST('/v1/trips/{id}/checklist', {
    params: { path: { id: tripId } },
    body: { items },
  });
  return data ?? null;
}

export async function setItemDone(tripId: string, itemId: string, done: boolean): Promise<Result> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.PATCH('/v1/trips/{id}/checklist/{itemId}', {
    params: { path: { id: tripId, itemId } },
    body: { done },
  });
  return data ?? null;
}

export async function removeItem(tripId: string, itemId: string): Promise<Result> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.DELETE('/v1/trips/{id}/checklist/{itemId}', {
    params: { path: { id: tripId, itemId } },
  });
  return data ?? null;
}
