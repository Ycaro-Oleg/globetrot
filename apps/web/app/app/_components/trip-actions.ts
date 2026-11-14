'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
import { SELECTED_TRIP_COOKIE } from '../../../lib/trips';

async function client() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  return {
    store,
    api: cookieHeader ? createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() }) : null,
  };
}

/** Renames a trip or sets its start date (`null` clears it). `true` when it saved. */
export async function updateTripFields(
  tripId: string,
  fields: { title?: string; startDate?: string | null },
): Promise<boolean> {
  const { api } = await client();
  if (!api) return false;
  const body: { title?: string; startDate?: string | null } = {};
  if (fields.title !== undefined) body.title = fields.title.trim().slice(0, 120);
  if (fields.startDate !== undefined) {
    if (fields.startDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fields.startDate)) return false;
    body.startDate = fields.startDate;
  }
  if (Object.keys(body).length === 0) return false;
  try {
    const { data } = await api.PATCH('/v1/trips/{id}', { params: { path: { id: tripId } }, body });
    return data !== undefined;
  } catch {
    return false;
  }
}

/** Makes a trip the current one (its page was opened from a link or a bookmark). `true` when it changed. */
export async function selectTrip(tripId: string): Promise<boolean> {
  const { store, api } = await client();
  if (!api) return false;
  const { data } = await api.GET('/v1/trips/{id}', { params: { path: { id: tripId } } });
  if (!data || store.get(SELECTED_TRIP_COOKIE)?.value === data.id) return false;
  store.set(SELECTED_TRIP_COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}

/** The trip tools a hub link may open. */
const PLACES = ['/app/board', '/app/days', '/app/budget', '/app/lists', '/app/pip'] as const;

/** Makes a trip the current one and opens one of its tools (the tools always show the current trip). */
export async function openTripAt(formData: FormData): Promise<void> {
  const id = formData.get('tripId');
  const to = PLACES.find((place) => place === formData.get('to')) ?? '/app/board';
  const { store, api } = await client();
  if (!api || typeof id !== 'string') redirect('/app/trips');
  const { data } = await api.GET('/v1/trips/{id}', { params: { path: { id } } });
  if (!data) redirect('/app/trips?status=not-found');
  store.set(SELECTED_TRIP_COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(to);
}
