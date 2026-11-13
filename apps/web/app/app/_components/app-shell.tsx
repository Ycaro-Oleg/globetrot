import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { TripView } from '../../../lib/trips';
import { SITE_NAME } from '../../site';
import { DEFAULT_PIP_LOOK, type PipLook } from '@globetrot/domain';
import { AccountMenu } from './account-menu';
import { PipLookProvider } from './pip-look';
import { BottomBar, GlobalNav, TripTabs } from './nav-links';
import { TripSwitcher } from './trip-switcher';
import styles from './shell.module.css';

/**
 * The frame around every signed-in page (design handoff v2, the TopBar): one sticky bar with the logo, the trip
 * switcher, the trip's tools and, on the right, the account's places and the avatar menu. On a phone the trip's
 * tools become a second row and the account's places a bottom bar (hidden on the map).
 */
export function AppShell({
  userName,
  pipEnabled,
  trips = [],
  activeTripId = null,
  pipLook = null,
  pipName = null,
  children,
}: {
  userName: string;
  pipEnabled: boolean;
  trips?: readonly TripView[];
  activeTripId?: string | null;
  /** The person's own Pip; the default look until they dress it. */
  pipLook?: PipLook | null;
  pipName?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations('shell');

  return (
    <PipLookProvider look={pipLook ?? DEFAULT_PIP_LOOK} name={pipName}>
      <div className={styles.shell}>
        <a href="#main" className={styles.skip}>
          {t('skipLink')}
        </a>

        <div className={styles.top}>
          <header className={styles.bar}>
            <Link href="/app/board" className={styles.logo}>
              <span className={styles.logoRing} aria-hidden="true" />
              <span className={styles.wordmark}>{SITE_NAME.toLowerCase()}</span>
            </Link>
            <TripSwitcher trips={trips} activeTripId={activeTripId} />
            <TripTabs variant="inline" />
            <span className={styles.spacer} />
            <GlobalNav pipEnabled={pipEnabled} />
            <AccountMenu name={userName} />
          </header>
          <TripTabs variant="row" />
        </div>

        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>

        <BottomBar pipEnabled={pipEnabled} />
      </div>
    </PipLookProvider>
  );
}
