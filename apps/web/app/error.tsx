'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PipAvatar } from './app/_components/pip-avatar';
import styles from './status-page.module.css';

/** What a public page shows when it throws: try again, or go home. Never the error's details. */
export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('statusPages');
  return (
    <main className={styles.page} role="alert">
      <PipAvatar size={120} pose="unsure" bare />
      <h1>{t('errorTitle')}</h1>
      <p>{t('errorBody')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>
          {t('retry')}
        </button>
        <Link className={styles.ghost} href="/">
          {t('toHome')}
        </Link>
      </div>
    </main>
  );
}
