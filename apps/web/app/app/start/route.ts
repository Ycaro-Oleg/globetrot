import { createHash } from 'node:crypto';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { actionApiClient } from '../../../lib/action-client';
import { PLAN_DRAFT_COOKIE, readDraft } from '../../../lib/plan-draft';
import { SELECTED_TRIP_COOKIE } from '../../../lib/trips';

/**
 * Where sign-up lands someone who built a plan on the landing: the plan becomes their trip (ADR-0020) and the map
 * opens on it, with no onboarding to answer again. The key comes from the saved plan itself, so a second visit
 * (a double tap, a back button) finds the same trip instead of making another.
 */
export async function GET() {
  const store = await cookies();
  const raw = store.get(PLAN_DRAFT_COOKIE)?.value;
  const draft = readDraft(raw);
  if (!raw || !draft?.suggestion) redirect('/app');
  const client = await actionApiClient();
  if (!client) redirect('/login?next=%2Fapp%2Fstart');

  const locale = (await getLocale()) === 'pt-BR' ? 'pt-BR' : 'en';
  const t = await getTranslations('onboarding');
  const key = `plan-${createHash('sha256').update(raw).digest('hex').slice(0, 40)}`;
  const { data, error } = await client.POST('/v1/trips/from-suggestion', {
    body: {
      ...draft.suggestion,
      // `readDraft` only keeps a destination from the catalog, which is what the API takes.
      destination: draft.suggestion.destination as 'japan',
      currency: draft.currency ?? 'USD',
      monthly: draft.monthly,
      estimateLabel: t('estimateCost'),
      locale,
    },
    headers: { 'Idempotency-Key': key },
  });
  if (!data) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    redirect(code === 'TRIP_LIMIT_REACHED' || code === 'PLAN_REQUIRED' ? '/app/plan' : '/app');
  }
  store.set(SELECTED_TRIP_COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  store.delete(PLAN_DRAFT_COOKIE);
  redirect('/app/board');
}
