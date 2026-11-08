import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SITE_NAME } from '../../site';
import { AccountMenu } from './account-menu';
import { RailNav, TabBar } from './nav-links';
import { BRAND_ICON as BrandIcon, PIP_HREF, PIP_ICON as PipIcon } from './nav-model';
import styles from './shell.module.css';

/**
 * The frame around every signed-in page.
 *
 * Three layouts from one markup, switched by CSS (see shell.module.css): on a wide screen a labelled rail on the
 * left, on a tablet a rail of icons, on a phone a top bar plus a floating bar of five tabs. The parts that a
 * layout does not show are `display: none`, so they are also out of the accessibility tree.
 */
export function AppShell({
  userName,
  pipEnabled,
  children,
}: {
  userName: string;
  pipEnabled: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('shell');

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        {t('skipLink')}
      </a>

      <div className={styles.rail}>
        <Link href="/app" className={styles.brand}>
          <BrandIcon aria-hidden="true" strokeWidth={1.6} size={26} />
          <span className={styles.brandName}>{SITE_NAME}</span>
        </Link>
        <RailNav />
        <div className={styles.railFooter}>
          {pipEnabled ? (
            <Link href={PIP_HREF} className={styles.pipRail}>
              <PipIcon aria-hidden="true" strokeWidth={1.6} size={22} />
              <span className={styles.pipRailLabel}>{t('pip.ask')}</span>
            </Link>
          ) : null}
          <AccountMenu name={userName} placement="above" />
        </div>
      </div>

      <header className={styles.topBar}>
        <Link href="/app" className={styles.topBrand}>
          <BrandIcon aria-hidden="true" strokeWidth={1.6} size={24} />
          <span>{SITE_NAME}</span>
        </Link>
        <AccountMenu name={userName} placement="below" />
      </header>

      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>

      {pipEnabled ? (
        <Link href={PIP_HREF} className={styles.pipFab} aria-label={t('pip.ask')}>
          <PipIcon aria-hidden="true" strokeWidth={1.6} size={26} />
        </Link>
      ) : null}
      <TabBar />
    </div>
  );
}
