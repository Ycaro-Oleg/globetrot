'use server';

import { CHECKLIST_GROUPS } from '@globetrot/domain';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';

const BACK = '/app/lists';

async function apiClient() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) redirect('/login?next=%2Fapp%2Flists');
  return createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};
const groupOf = (formData: FormData) =>
  CHECKLIST_GROUPS.find((candidate) => candidate === text(formData, 'group'));

/** After a change that worked the page refreshes in place; a failure says so on the page. */
function done(ok: boolean, flash?: string): never | void {
  if (!ok) redirect(`${BACK}?status=error`);
  revalidatePath(BACK);
  if (flash) redirect(`${BACK}?status=${flash}`);
}

export async function addItem(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  const group = groupOf(formData);
  const label = text(formData, 'label');
  if (!tripId || !group || !label) redirect(`${BACK}?status=error`);
  const { data } = await (
    await apiClient()
  ).POST('/v1/trips/{id}/checklist', {
    params: { path: { id: tripId } },
    body: { items: [{ group, label }] },
  });
  done(Boolean(data));
}

/** Adds the suggested items, written in the language the person is using now. */
export async function addSuggestions(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  if (!tripId) redirect(`${BACK}?status=error`);
  const t = await getTranslations('listsPage.suggestions');
  const items = CHECKLIST_GROUPS.flatMap((group) =>
    Object.values(t.raw(group) as Record<string, string>).map((label) => ({ group, label })),
  );
  const { data } = await (
    await apiClient()
  ).POST('/v1/trips/{id}/checklist', {
    params: { path: { id: tripId } },
    body: { items },
  });
  done(Boolean(data), 'suggested');
}

export async function setItemDone(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  const itemId = text(formData, 'itemId');
  if (!tripId || !itemId) redirect(`${BACK}?status=error`);
  const { data } = await (
    await apiClient()
  ).PATCH('/v1/trips/{id}/checklist/{itemId}', {
    params: { path: { id: tripId, itemId } },
    body: { done: text(formData, 'done') === 'true' },
  });
  done(Boolean(data));
}

export async function removeItem(formData: FormData): Promise<void> {
  const tripId = text(formData, 'tripId');
  const itemId = text(formData, 'itemId');
  if (!tripId || !itemId) redirect(`${BACK}?status=error`);
  const { data } = await (
    await apiClient()
  ).DELETE('/v1/trips/{id}/checklist/{itemId}', {
    params: { path: { id: tripId, itemId } },
  });
  done(Boolean(data));
}
