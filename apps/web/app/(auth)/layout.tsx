import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Logomark } from '../logomark';
import { SITE_NAME } from '../site';
import { LanguageSwitcher } from './_components/language-switcher';
import styles from './auth.module.css';

/** Branded account frame: the illustrated world map and the working form stay clear at every width. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  return (
    <div className={styles.shell}>
      <aside className={styles.art} aria-hidden="true">
        <div className={styles.map} />
        <div className={styles.headline}>
          <h1>
            {t.rich('brand.headline', {
              accent: (chunks) => <em>{chunks}</em>,
            })}
          </h1>
          <p>{t('brand.supporting')}</p>
        </div>
      </aside>
      <main className={styles.panel}>
        <div className={styles.panelInner}>
          <Link href="/" className={styles.brand} aria-label={SITE_NAME}>
            <Logomark className={styles.brandMark} />
            <span>{SITE_NAME}</span>
          </Link>
          {children}
          <LanguageSwitcher />
        </div>
      </main>
    </div>
  );
}
