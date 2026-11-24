import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '../../site';
import styles from './shell.module.css';

/** The sections that exist in the navigation but are not built yet. Each is a key of `shell.comingSoon`. */
export type ComingSoonSection = 'board';

/** Page title for a section: its navigation label, then the product name. */
export async function sectionTitle(section: ComingSoonSection): Promise<string> {
  const t = await getTranslations('shell.nav');
  return `${t(section)} \u00b7 ${SITE_NAME}`;
}

/**
 * Honest placeholder for a destination whose feature is on the roadmap but not built. It says so plainly (no
 * fake data, no disabled controls) and leads back to the one page that works.
 */
export function ComingSoon({ section }: { section: ComingSoonSection }) {
  const nav = useTranslations('shell.nav');
  const t = useTranslations('shell.comingSoon');
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>{t('label')}</p>
      <h1 className={styles.pageTitle}>{nav(section)}</h1>
      <p className={styles.lead}>{t(section)}</p>
      <p>
        <Link href="/app">{t('backHome')}</Link>
      </p>
    </section>
  );
}
