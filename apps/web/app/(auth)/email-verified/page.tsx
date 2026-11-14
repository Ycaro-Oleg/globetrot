import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Banner } from '@globetrot/ui';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchCurrentUser } from '../../../lib/current-user';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { SITE_NAME } from '../../site';
import { ResendForm } from '../_components/resend-form';
import styles from '../auth.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: `${t('verified.title')} · ${SITE_NAME}`, robots: { index: false } };
}

/**
 * Where the verification email leads. Following the link verifies the address and opens a session, then
 * Better Auth redirects here. Success is shown only when the visitor really is signed in with a verified
 * address. An expired or tampered link (`?error=…`), or a link that was already used (it opens no session the
 * second time), shows the problem and a way to ask for a new one, instead of a success that did not happen.
 */
export default async function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const t = await getTranslations('auth.verified');
  const [query, store] = await Promise.all([searchParams, cookies()]);

  const cookieHeader = sessionCookieHeader(store.getAll());
  const user =
    query.error === undefined && cookieHeader
      ? await fetchCurrentUser({ cookieHeader, apiUrl: apiInternalUrl() })
      : null;

  if (user?.emailVerified) {
    return (
      <>
        <h1 className={styles.title}>{t('title')}</h1>
        <Banner tone="success" role="status">
          {t('body')}
        </Banner>
        <Link href="/app" className={styles.ctaLink}>
          {t('continue')} <span aria-hidden="true">→</span>
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>{t('errorTitle')}</h1>
      <Banner tone="error" role="alert">
        {t('errorBody')}
      </Banner>
      <ResendForm />
    </>
  );
}
