import { catalogs } from '@globetrot/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { LEAD_TOKEN_PATTERN, listLocale } from '../../../lib/leads';
import { LeaveListButton } from '../../_interest-list/leave-list-button';
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
    namespace: 'interestList.leave',
  });
  return { title: `${t('title')} · ${SITE_NAME}`, robots: { index: false, follow: false } };
}

/** "Leave the list?" from a list email, in the email's language (`lang`). */
export default async function LeaveListPage({ searchParams }: Props) {
  const locale = await pageLocale(searchParams);
  const raw = (await searchParams).token;
  const token = typeof raw === 'string' && LEAD_TOKEN_PATTERN.test(raw) ? raw : null;
  const t = await getTranslations({ locale, namespace: 'interestList.leave' });
  return (
    <main className={styles.page} lang={locale}>
      {token ? (
        <NextIntlClientProvider
          locale={locale}
          messages={{ interestList: catalogs[locale].interestList }}
        >
          <LeaveListButton token={token} />
        </NextIntlClientProvider>
      ) : (
        <>
          <h1>{t('invalidTitle')}</h1>
          <p>{t('invalidBody')}</p>
          <p>
            <Link href="/">{t('back')}</Link>
          </p>
        </>
      )}
    </main>
  );
}
