import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { SITE_NAME } from '../site';
import { LanguageSwitcher } from './_components/language-switcher';
import styles from './auth.module.css';

/** The frame of every account page: poster art beside (or above, on a phone) the form. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  return (
    <div className={styles.shell}>
      <div className={styles.art} aria-hidden="true">
        <p className={styles.headline}>{t('brand.headline')}</p>
      </div>
      <main className={styles.panel}>
        <p className={styles.brand}>{SITE_NAME}</p>
        {children}
        <LanguageSwitcher />
      </main>
    </div>
  );
}
