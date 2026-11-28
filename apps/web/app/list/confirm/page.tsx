import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { confirmInterest, listLocale } from '../../../lib/leads';
import styles from '../../_interest-list/interest-list.module.css';
import { SITE_NAME } from '../../site';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ token?: string | string[]; lang?: string | string[] }> };

async function pageLocale(searchParams: Props['searchParams']) {
  return (
    listLocale((await searchParams).lang) ?? ((await getLocale()) === 'pt-BR' ? 'pt-BR' : 'en')
  );
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations({
    locale: await pageLocale(searchParams),
    namespace: 'interestList.confirm',
  });
  return { title: `${t('pageTitle')} · ${SITE_NAME}`, robots: { index: false, follow: false } };
}

/**
 * The confirmation link of a list email (#191's contract): confirmed, already confirmed, expired or not found, in
 * the email's language, each with the way back to the landing. Confirming twice changes nothing.
 */
export default async function ConfirmListPage({ searchParams }: Props) {
  const locale = await pageLocale(searchParams);
  const t = await getTranslations({ locale, namespace: 'interestList.confirm' });
  const answer = await confirmInterest((await searchParams).token, { apiUrl: apiInternalUrl() });
  const state = answer?.result ?? 'unavailable';
  return (
    <main className={styles.page} lang={locale}>
      <h1>{t(`${state}.title`)}</h1>
      <p>{t(`${state}.body`)}</p>
      <p>
        <Link href="/">{t('back')}</Link>
      </p>
    </main>
  );
}
