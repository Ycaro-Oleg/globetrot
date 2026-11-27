'use server';

import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';

export type CheckoutResult = { url: string } | { error: 'unavailable' | 'failed' };

async function client() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  return cookieHeader ? createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
}

const problemCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

/**
 * Where to pay for a plan, extra credits or a trip pass; `unavailable` while payments are not switched on. The
 * API checks that a pass is for one of the person's own trips.
 */
export async function startCheckout(
  item: 'explorer' | 'voyager' | 'top-up' | 'top-up-small' | 'trip-pass',
  interval: 'month' | 'year',
  tripId?: string,
): Promise<CheckoutResult> {
  const api = await client();
  if (!api) return { error: 'failed' };
  try {
    const { data, error } = await api.POST('/v1/me/billing/checkout', {
      body: { item, interval, ...(tripId ? { tripId } : {}) },
    });
    if (data) return { url: data.url };
    return { error: problemCode(error) === 'SERVICE_UNAVAILABLE' ? 'unavailable' : 'failed' };
  } catch {
    return { error: 'failed' };
  }
}

export async function openPortal(): Promise<CheckoutResult> {
  const api = await client();
  if (!api) return { error: 'failed' };
  try {
    const { data, error } = await api.POST('/v1/me/billing/portal');
    if (data) return { url: data.url };
    return { error: problemCode(error) === 'SERVICE_UNAVAILABLE' ? 'unavailable' : 'failed' };
  } catch {
    return { error: 'failed' };
  }
}
