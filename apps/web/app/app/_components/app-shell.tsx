import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { TripView } from '../../../lib/trips';
import { SITE_NAME } from '../../site';
import { AccountMenu } from './account-menu';
import { RailNav, TabBar } from './nav-links';
import { BRAND_ICON as BrandIcon, PIP_HREF } from './nav-model';
import { PipAvatar } from './pip-avatar';
import { TripSwitcher } from './trip-switcher';
import styles from './shell.module.css';

/**
 * The frame around every signed-in page.
 *
 * Three layouts from one markup, switched by CSS (see shell.module.css): on a wide screen a labelled rail on the
 * left, on a tablet a rail of icons, on a phone a top bar plus a floating bar of five tabs.
 */
export function AppShell({
  userName,
  pipEnabled,
  trips = [],
  activeTripId = null,
  children,
}: {
  userName: string;
  pipEnabled: boolean;
  trips?: readonly TripView[];
  activeTripId?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations('shell');
  const tripT = useTranslations('tripWorkspace');
  const activeTrip = trips.find((trip) => trip.id === activeTripId) ?? null;

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
        <TripSwitcher trips={trips} activeTripId={activeTripId} />
        <RailNav />
        <div className={styles.railFooter}>
          <AccountMenu name={userName} placement="above" />
        </div>
      </div>

      <header className={styles.desktopBar}>
        <div className={styles.workspaceHeading}>
          <span>{tripT('eyebrow')}</span>
          <strong>{activeTrip?.title ?? tripT('title')}</strong>
        </div>
        {pipEnabled ? (
          <Link href={PIP_HREF} className={styles.desktopPip}>
            <PipAvatar size={26} still />
            <span>{t('pip.ask')}</span>
          </Link>
        ) : null}
      </header>

      <header className={styles.topBar}>
        <div className={styles.topBarBrand}>
          <Link href="/app" className={styles.topBrand}>
            <BrandIcon aria-hidden="true" strokeWidth={1.6} size={24} />
            <span>{SITE_NAME}</span>
          </Link>
          <TripSwitcher trips={trips} activeTripId={activeTripId} />
        </div>
        <AccountMenu name={userName} placement="below" />
      </header>

      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>

      {pipEnabled ? (
        <Link href={PIP_HREF} className={styles.pipFab} aria-label={t('pip.ask')}>
          <PipAvatar size={40} still />
        </Link>
      ) : null}
      <TabBar />
    </div>
  );
}
