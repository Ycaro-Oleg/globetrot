import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchBilling } from '../../../lib/billing';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
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
  searchParams: Promise<{ paid?: string; status?: string }>;
}) {
  const { paid, status } = await searchParams;
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const [billing, referral] = options
    ? await Promise.all([
        fetchBilling(options),
        // Makes the person's code the first time they open the page (ADR-0029).
        createServerApiClient(options)
          .POST('/v1/me/referral')
          .then((response) => response.data ?? null)
          .catch(() => null),
      ])
    : [null, null];
  return (
    <PlanView
      billing={billing}
      referral={referral}
      planRequired={status === 'plan-required'}
      paid={
        paid === 'top-up' || paid === 'top-up-small'
          ? 'top-up'
          : paid === 'explorer' || paid === 'voyager'
            ? 'plan'
            : null
      }
    />
  );
}
