'use server';

import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { actionApiClient } from '../../../lib/action-client';
import { SELECTED_TRIP_COOKIE } from '../../../lib/trips';

const problemCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

export type InviteResult = { token: string; expiresAt: string } | { error: 'limit' | 'failed' };

/** A new invite link for one of the person's trips; `limit` when the plan allows no more people. */
export async function createInviteLink(
  tripId: string,
  role: 'editor' | 'viewer',
): Promise<InviteResult> {
  const api = await actionApiClient();
  if (!api) return { error: 'failed' };
  try {
    const { data, error } = await api.POST('/v1/trips/{id}/invites', {
      params: { path: { id: tripId } },
      body: { role },
    });
    if (data) return { token: data.token, expiresAt: data.expiresAt };
    return { error: problemCode(error) === 'GUEST_LIMIT_REACHED' ? 'limit' : 'failed' };
  } catch (error) {
    unstable_rethrow(error);
    return { error: 'failed' };
  }
}

/** Stops an invite link. `true` when it did. */
export async function revokeInviteLink(tripId: string, inviteId: string): Promise<boolean> {
  const api = await actionApiClient();
  if (!api) return false;
  try {
    const { data } = await api.DELETE('/v1/trips/{id}/invites/{inviteId}', {
      params: { path: { id: tripId, inviteId } },
    });
    return data?.revoked === true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

/** The owner takes someone off the trip. `true` when it did. */
export async function removeTripMember(tripId: string, userId: string): Promise<boolean> {
  const api = await actionApiClient();
  if (!api) return false;
  try {
    const { data } = await api.DELETE('/v1/trips/{id}/members/{userId}', {
      params: { path: { id: tripId, userId } },
    });
    return data?.removed === true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}

/** Leaves a trip one was invited to, then goes to the trip list. */
export async function leaveTrip(formData: FormData) {
  const tripId = String(formData.get('tripId') ?? '');
  const api = await actionApiClient();
  if (api && tripId) {
    await api.POST('/v1/trips/{id}/leave', { params: { path: { id: tripId } } }).catch(() => null);
    const store = await cookies();
    if (store.get(SELECTED_TRIP_COOKIE)?.value === tripId) store.delete(SELECTED_TRIP_COOKIE);
  }
  redirect('/app/trips');
}

/** Joins a trip through an invite link, makes it the current trip and opens its map. */
export async function acceptInvite(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const api = await actionApiClient();
  if (!api || !/^[A-Za-z0-9_-]{22}$/.test(token)) redirect('/app');
  const { data, error } = await api.POST('/v1/invites/{token}', {
    params: { path: { token } },
  });
  if (!data) {
    redirect(
      `/app/invite/${token}?status=${problemCode(error) === 'GUEST_LIMIT_REACHED' ? 'limit' : 'error'}`,
    );
  }
  const store = await cookies();
  store.set(SELECTED_TRIP_COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/app/board?joined=1');
}
