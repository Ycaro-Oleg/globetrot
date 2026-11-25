'use client';

import { Button } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { isStaleVersionError, reloadOnceForNewVersion } from '../../lib/stale-version';
import { PipAvatar } from './_components/pip-avatar';
import styles from './_components/shell.module.css';

/**
 * What a signed-in page shows when it throws: a way to retry and a way out, inside the shell. A tab left open
 * across a deploy is not an error: it reloads once for the new version, or offers to.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('shell');
  const stale = isStaleVersionError(error);
  useEffect(() => {
    if (stale) reloadOnceForNewVersion();
  }, [stale]);
  if (stale)
    return (
      <section className={styles.card} role="alert">
        <PipAvatar size={96} pose="research" />
        <h1 className={styles.pageTitle}>{t('error.staleTitle')}</h1>
        <p className={styles.lead}>{t('error.staleDescription')}</p>
        <p className={styles.actions}>
          <Button onPress={() => window.location.reload()}>{t('error.reload')}</Button>
        </p>
      </section>
    );
  return (
    <section className={styles.card} role="alert">
      <PipAvatar size={96} pose="unsure" />
      <h1 className={styles.pageTitle}>{t('error.title')}</h1>
      <p className={styles.lead}>{t('error.description')}</p>
      <p className={styles.actions}>
        <Button onPress={reset}>{t('error.retry')}</Button>
        <Link href="/app">{t('comingSoon.backHome')}</Link>
      </p>
    </section>
  );
}
