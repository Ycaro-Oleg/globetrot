import { DEFAULT_CURRENCY, formatMoney, fromDecimal } from '@globetrot/domain';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchCurrentUser } from '../../../lib/current-user';
import { PLAN_DRAFT_COOKIE, readDraft } from '../../../lib/plan-draft';
import { fetchEnabledProviders } from '../../../lib/providers';
import { safeNext } from '../../../lib/safe-next';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { SITE_NAME } from '../../site';
import { SignupForm } from '../_components/signup-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: `${t('signup.title')} · ${SITE_NAME}` };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [query, store, locale, t] = await Promise.all([
    searchParams,
    cookies(),
    getLocale(),
    getTranslations('auth.signup'),
  ]);
  const next = safeNext(query.next);
  // Someone already signed in (a landing link sends everyone here) goes straight to where they were headed.
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (cookieHeader && (await fetchCurrentUser({ cookieHeader, apiUrl: apiInternalUrl() }))) {
    redirect(next);
  }
  const providers = await fetchEnabledProviders({ apiUrl: apiInternalUrl() });
  // Someone who saved a plan in the landing's "Can I go?" sees it again here, so the story continues.
  const draft = readDraft(store.get(PLAN_DRAFT_COOKIE)?.value);
  const amount = (value: string) =>
    formatMoney(
      fromDecimal(value, draft?.currency ?? DEFAULT_CURRENCY, { rounding: 'half-even' }),
      locale,
      {
        precision: 'whole',
      },
    );
  const planNote = draft
    ? t('planSaved', {
        cost: amount(draft.cost),
        saved: amount(draft.saved),
        monthly: amount(draft.monthly),
      })
    : null;
  return (
    <SignupForm next={next} googleEnabled={providers.includes('google')} planNote={planNote} />
  );
}
