'use server';

import { idempotencyKeySchema } from '@globetrot/application';
import { getTranslations } from 'next-intl/server';
import { CHECKLIST_GROUPS } from '@globetrot/domain';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PLAN_DRAFT_COOKIE } from '../../lib/plan-draft';
import { apiInternalUrl } from '../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../lib/stored-preferences';
import { SELECTED_TRIP_COOKIE } from '../../lib/trips';

export interface OnboardingPlace {
  /** Null when the person typed a name the search could not look up: the trip starts without a stop. */
  readonly key: string | null;
  readonly name: string;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface OnboardingInput {
  readonly idempotencyKey: string;
  readonly homeCity: string;
  /** Where the home city is, when it was picked from the city list: the map shows the trip starting there. */
  readonly homePoint: { readonly latitude: number; readonly longitude: number } | null;
  readonly destination: OnboardingPlace;
  /** `YYYY-MM-DD`: the day the trip starts (it can change later). */
  readonly startDate: string;
  readonly nights: number;
  /** The trip's currency: the destination's own by default, or the one the person picked. */
  readonly currency: string;
  /** The person's own rough guess of the whole trip, in their currency: stored as an estimate. */
  readonly estimate: string;
  readonly saved: string;
  readonly monthly: string;
  readonly pipOptIn: boolean;
}

/**
 * Turns the onboarding answers into a real trip, through the same API as everything else: the preferences (home
 * city, Pip), the trip in the person's currency, its first stop, the rough estimate as an estimate cost, and the
 * savings. Then it opens the map. Any failure stops and says so; nothing is invented on the way.
 */
export async function finishOnboarding(input: OnboardingInput): Promise<{ error: true }> {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) redirect('/login?next=%2Fonboarding');
  const key = idempotencyKeySchema.safeParse(input.idempotencyKey);
  if (!key.success || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { error: true };
  const client = createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
  const t = await getTranslations('onboarding');

  const preferences = await client.PATCH('/v1/me/preferences', {
    body: {
      ...(input.homeCity.trim()
        ? { homeCity: input.homeCity.trim().slice(0, 120), homePoint: input.homePoint }
        : {}),
      pipOptIn: input.pipOptIn,
    },
  });
  if (!preferences.data) return { error: true };

  const trip = await client.POST('/v1/trips', {
    body: {
      title: input.destination.name.slice(0, 120),
      currency: /^[A-Z]{3}$/.test(input.currency) ? input.currency : preferences.data.currency,
      startDate: input.startDate,
    },
    headers: { 'Idempotency-Key': key.data },
  });
  if (!trip.data) return { error: true };
  const tripId = trip.data.id;
  store.set(SELECTED_TRIP_COOKIE, tripId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  const place = input.destination;
  const route =
    place.key !== null && place.latitude !== null && place.longitude !== null
      ? await client.PUT('/v1/trips/{id}/destinations', {
          params: { path: { id: tripId } },
          body: {
            destinations: [
              {
                placeKey: place.key.slice(0, 200),
                name: place.name.slice(0, 200),
                countryCode: place.countryCode,
                region: place.region,
                latitude: place.latitude,
                longitude: place.longitude,
                nights: Math.max(0, Math.min(365, Math.round(input.nights))),
              },
            ],
          },
        })
      : { data: true };
  const cost = await client.POST('/v1/trips/{id}/expenses', {
    params: { path: { id: tripId } },
    body: {
      description: t('estimateCost'),
      category: 'other',
      status: 'estimate',
      amount: input.estimate,
      currency: trip.data.currency,
      // The rough guess stands for the whole trip: real costs added later come out of it.
      guess: true,
    },
  });
  const savings = await client.PUT('/v1/trips/{id}/savings', {
    params: { path: { id: tripId } },
    body: { saved: input.saved || '0', monthly: input.monthly || '0' },
  });
  // The first trip starts with the suggested lists in the person's language, so Lists is useful at once.
  const suggestions = await getTranslations('listsPage.suggestions');
  await client
    .POST('/v1/trips/{id}/checklist', {
      params: { path: { id: tripId } },
      body: {
        items: CHECKLIST_GROUPS.flatMap((group) =>
          Object.values(suggestions.raw(group) as Record<string, string>).map((label) => ({
            group,
            label,
          })),
        ),
      },
    })
    .catch(() => null);
  if (!route.data || !cost.data || !savings.data) return { error: true };
  // The landing's numbers have done their job.
  store.delete(PLAN_DRAFT_COOKIE);
  redirect('/app/board');
}
