import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchBilling } from '../../../lib/billing';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { SITE_NAME } from '../../site';
import { PlanView } from './plan-view';

export async function generateMetadata() {
  const t = await getTranslations('planPage');
  return { title: `${t('title')} · ${SITE_NAME}` };
}

/** The account's plan: the free week or the paid plan, Pip credits, active trips, and the way to pay. */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid } = await searchParams;
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const billing = cookieHeader
    ? await fetchBilling({ cookieHeader, apiUrl: apiInternalUrl() })
    : null;
  return (
    <PlanView
      billing={billing}
      paid={
        paid === 'top-up' ? 'top-up' : paid === 'explorer' || paid === 'voyager' ? 'plan' : null
      }
    />
  );
}
