'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { isStaleVersionError, reloadOnceForNewVersion } from '../lib/stale-version';
import { LazyPipAvatar as PipAvatar } from './app/_components/lazy-pip-avatar';
import styles from './status-page.module.css';

/**
 * What a public page shows when it throws: try again, or go home. Never the error's details. A tab left open
 * across a deploy reloads once for the new version, or offers to.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('statusPages');
  const stale = isStaleVersionError(error);
  useEffect(() => {
    if (stale) reloadOnceForNewVersion();
  }, [stale]);
  if (stale)
    return (
      <main className={styles.page} role="alert">
        <h1>{t('staleTitle')}</h1>
        <p>{t('staleBody')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            {t('reload')}
          </button>
        </div>
      </main>
    );
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
