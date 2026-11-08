'use client';

import { Button } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import styles from './_components/shell.module.css';

/** What a signed-in page shows when it throws: a way to retry and a way out, inside the shell. */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('shell');
  return (
    <section className={styles.card} role="alert">
      <h1 className={styles.pageTitle}>{t('error.title')}</h1>
      <p className={styles.lead}>{t('error.description')}</p>
      <p className={styles.actions}>
        <Button onPress={reset}>{t('error.retry')}</Button>
        <Link href="/app">{t('comingSoon.backHome')}</Link>
      </p>
    </section>
  );
}
