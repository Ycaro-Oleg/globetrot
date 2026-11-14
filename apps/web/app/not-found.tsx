import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PipAvatar } from './app/_components/pip-avatar';
import styles from './status-page.module.css';

/** Any address that does not exist: Pip, a plain sentence, and the two ways people usually want to go. */
export default async function NotFound() {
  const t = await getTranslations('statusPages');
  return (
    <main className={styles.page}>
      <PipAvatar size={120} mood="thinking" />
      <p className={styles.code}>404</p>
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFoundBody')}</p>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/app">
          {t('toTrips')}
        </Link>
        <Link className={styles.ghost} href="/">
          {t('toHome')}
        </Link>
      </div>
    </main>
  );
}
