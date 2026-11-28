'use server';

import { EXAMPLE_TRIP_IDS, idempotencyKeySchema } from '@globetrot/application';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { actionApiClient } from '../../../lib/action-client';
import { queueEvents } from '../../../lib/analytics';
import { SELECTED_TRIP_COOKIE } from '../../../lib/trips';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
});

async function apiClient() {
  const store = await cookies();
  const client = await actionApiClient();
  if (!client) redirect('/login?next=%2Fapp%2Ftrips');
  return { store, client };
}

export async function openTrip(formData: FormData): Promise<void> {
  const id = formData.get('tripId');
  if (typeof id !== 'string' || !id) redirect('/app/trips?status=not-found');
  const { store, client } = await apiClient();
  const { data } = await client.GET('/v1/trips/{id}', { params: { path: { id } } });
  if (!data) redirect('/app/trips?status=not-found');
  store.set(SELECTED_TRIP_COOKIE, data.id, cookieOptions());
  redirect(`/app/trips/${data.id}`);
}

/** A plan limit sends the person to the message that explains it, with the way to the plans. */
function planLimitStatus(error: unknown): string | null {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return code === 'TRIP_LIMIT_REACHED'
    ? 'trip-limit'
    : code === 'PLAN_REQUIRED'
      ? 'plan-required'
      : null;
}

export async function createTrip(formData: FormData): Promise<void> {
  const title = formData.get('title');
  const rawDate = formData.get('startDate');
  const currency = formData.get('currency');
  const idempotencyKey = idempotencyKeySchema.safeParse(formData.get('idempotencyKey'));
  if (
    typeof title !== 'string' ||
    typeof currency !== 'string' ||
    (rawDate !== null && typeof rawDate !== 'string') ||
    !idempotencyKey.success
  )
    redirect('/app/trips?status=create-error');

  const { store, client } = await apiClient();
  const { data, error } = await client.POST('/v1/trips', {
    body: { title, currency, startDate: rawDate || null },
    headers: { 'Idempotency-Key': idempotencyKey.data },
  });
  if (!data) redirect(`/app/trips?status=${planLimitStatus(error) ?? 'create-error'}`);
  store.set(SELECTED_TRIP_COOKIE, data.id, cookieOptions());
  queueEvents(store, { event: 'trip_created', once: data.id });
  redirect(`/app/trips/${data.id}`);
}

export async function archiveTrip(formData: FormData): Promise<void> {
  const id = formData.get('tripId');
  if (typeof id !== 'string' || !id) redirect('/app/trips?status=error');
  const { store, client } = await apiClient();
  const { data } = await client.POST('/v1/trips/{id}/archive', { params: { path: { id } } });
  if (!data) redirect('/app/trips?status=error');

  if (store.get(SELECTED_TRIP_COOKIE)?.value === data.id) {
    const { data: list } = await client.GET('/v1/trips');
    const nextTrip = list?.trips[0];
    if (nextTrip) store.set(SELECTED_TRIP_COOKIE, nextTrip.id, cookieOptions());
    else store.delete(SELECTED_TRIP_COOKIE);
  }
  redirect(`/app/trips?archived=${encodeURIComponent(data.id)}`);
}

export async function undoArchiveTrip(formData: FormData): Promise<void> {
  const id = formData.get('tripId');
  if (typeof id !== 'string' || !id) redirect('/app/trips?status=error');
  const { store, client } = await apiClient();
  const { data, error } = await client.PATCH('/v1/trips/{id}', {
    params: { path: { id } },
    body: { status: 'active' },
  });
  if (!data) redirect(`/app/trips?status=${planLimitStatus(error) ?? 'error'}`);
  store.set(SELECTED_TRIP_COOKIE, data.id, cookieOptions());
  redirect(`/app/trips/${data.id}`);
}

/** Deletes an archived trip for good (the page asked to confirm first). */
export async function deleteTrip(formData: FormData): Promise<void> {
  const id = formData.get('tripId');
  if (typeof id !== 'string' || !id) redirect('/app/trips?filter=archived&status=error');
  const { store, client } = await apiClient();
  const { data } = await client.DELETE('/v1/trips/{id}', { params: { path: { id } } });
  if (!data) redirect('/app/trips?filter=archived&status=error');
  if (store.get(SELECTED_TRIP_COOKIE)?.value === id) store.delete(SELECTED_TRIP_COOKIE);
  redirect('/app/trips?filter=archived&status=deleted');
}

/** Copies a public example trip into the person's account and opens it on the board. */
export async function copyExampleTrip(formData: FormData): Promise<void> {
  const exampleId = EXAMPLE_TRIP_IDS.find((id) => id === formData.get('exampleId'));
  const idempotencyKey = idempotencyKeySchema.safeParse(formData.get('idempotencyKey'));
  if (!exampleId || !idempotencyKey.success) redirect('/app/trips?status=example-error');
  const t = await getTranslations('tripWorkspace.example.trips');
  const { store, client } = await apiClient();
  const { data, error } = await client.POST('/v1/trips/from-example', {
    body: {
      exampleId,
      title: t(exampleId),
      locale: (await getLocale()) === 'pt-BR' ? 'pt-BR' : 'en',
    },
    headers: { 'Idempotency-Key': idempotencyKey.data },
  });
  if (!data) redirect(`/app/trips?status=${planLimitStatus(error) ?? 'example-error'}`);
  store.set(SELECTED_TRIP_COOKIE, data.id, cookieOptions());
  redirect('/app/board');
}
