'use server';

import {
  SUGGEST_COMFORTS,
  SUGGEST_LIKES,
  SUGGEST_RATE_CURRENCIES,
  SUGGESTED_DESTINATIONS,
  type SuggestComfort,
  type SuggestLike,
} from '@globetrot/domain';
import { randomUUID } from 'node:crypto';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { actionApiClient } from '../../../lib/action-client';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchStoredPreferences, sessionCookieHeader } from '../../../lib/stored-preferences';
import { SELECTED_TRIP_COOKIE } from '../../../lib/trips';

/** Turns one of the ready plans into a trip of the person's, with the days and likes they picked on the card. */
export async function buildSuggestedTrip(formData: FormData): Promise<void> {
  const destination = SUGGESTED_DESTINATIONS.find(
    (place) => place.id === formData.get('destination'),
  );
  const days = Number(formData.get('days'));
  const comfort = SUGGEST_COMFORTS.find((option) => option === formData.get('comfort')) ?? 'budget';
  const likes = formData
    .getAll('likes')
    .filter((like): like is SuggestLike => SUGGEST_LIKES.includes(like as SuggestLike));
  if (!destination || !Number.isInteger(days)) redirect('/app/discover?status=error');
  const client = await actionApiClient();
  if (!client) redirect('/login?next=%2Fapp%2Fdiscover');
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const preferences = cookieHeader
    ? await fetchStoredPreferences({ cookieHeader, apiUrl: apiInternalUrl() })
    : null;
  const currency = (SUGGEST_RATE_CURRENCIES as readonly string[]).includes(
    preferences?.currency ?? '',
  )
    ? preferences!.currency
    : 'USD';
  const t = await getTranslations('onboarding');
  const { data, error } = await client.POST('/v1/trips/from-suggestion', {
    body: {
      destination: destination.id as 'japan',
      likes,
      days,
      comfort: comfort as SuggestComfort,
      currency,
      estimateLabel: t('estimateCost'),
      locale: (await getLocale()) === 'pt-BR' ? 'pt-BR' : 'en',
    },
    headers: { 'Idempotency-Key': randomUUID() },
  });
  if (!data) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    redirect(
      code === 'TRIP_LIMIT_REACHED' || code === 'PLAN_REQUIRED'
        ? '/app/plan'
        : '/app/discover?status=error',
    );
  }
  store.set(SELECTED_TRIP_COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/app/board');
}
