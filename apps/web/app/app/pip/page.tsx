import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { isPipEnabled } from '../../../lib/flags';
import { SITE_NAME } from '../../site';
import { PipAvatar } from '../_components/pip-avatar';
import styles from '../_components/shell.module.css';

export async function generateMetadata() {
  const t = await getTranslations('shell.pip');
  return { title: `${t('title')} \u00b7 ${SITE_NAME}` };
}

/**
 * Where the Pip entry points lead while Pip itself is not built. The page exists only behind the `FEATURE_PIP`
 * flag; with the flag off it is a plain 404, like any page that does not exist.
 */
export default function PipPage() {
  const t = useTranslations('shell.pip');
  const soon = useTranslations('shell.comingSoon');
  if (!isPipEnabled()) notFound();
  return (
    <section className={styles.card}>
      <PipAvatar size={160} followPointer />
      <p className={styles.eyebrow}>{soon('label')}</p>
      <h1 className={styles.pageTitle}>{t('title')}</h1>
      <p className={styles.lead}>{t('notBuilt')}</p>
      <p>
        <Link href="/app">{soon('backHome')}</Link>
      </p>
    </section>
  );
}
