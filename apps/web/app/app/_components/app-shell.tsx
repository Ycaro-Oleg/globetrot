import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { TripView } from '../../../lib/trips';
import { Logomark } from '../../logomark';
import { SITE_NAME } from '../../site';
import { DEFAULT_PIP_LOOK, type PipLook } from '@globetrot/domain';
import type { BillingView } from '../../../lib/billing';
import { AccountMenu } from './account-menu';
import { PlanBanner } from './plan-banner';
import { PipLookProvider } from './pip-look';
import { BottomBar, GlobalNav, TripTabs } from './nav-links';
import { TRIP_HOME } from './nav-model';
import { PipFab } from './pip-fab';
import { offlineAllowed } from '../../../lib/offline';
import { OfflineSupport } from './offline-support';
import { ReferralClaim } from './referral-claim';
import { TripRefresh } from './trip-refresh';
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
  billing = null,
  children,
}: {
  userName: string;
  pipEnabled: boolean;
  trips?: readonly TripView[];
  activeTripId?: string | null;
  /** The person's own Pip; the default look until they dress it. */
  pipLook?: PipLook | null;
  pipName?: string | null;
  /** The plan facts for the free-week line; null shows nothing. */
  billing?: BillingView | null;
  children: ReactNode;
}) {
  const t = useTranslations('shell');
  const activeTrip = trips.find((trip) => trip.id === activeTripId);

  return (
    <PipLookProvider look={pipLook ?? DEFAULT_PIP_LOOK} name={pipName}>
      <div className={styles.shell}>
        <a href="#main" className={styles.skip}>
          {t('skipLink')}
        </a>

        <div className={styles.top}>
          <header className={styles.bar}>
            <Link href={TRIP_HOME} className={styles.logo}>
              <Logomark className={styles.logoRing} />
              <span className={styles.wordmark}>{SITE_NAME}</span>
            </Link>
            <TripSwitcher trips={trips} activeTripId={activeTripId} />
            <TripTabs variant="inline" />
            <span className={styles.spacer} />
            <PlanBanner billing={billing} variant="pill" />
            <GlobalNav />
            <AccountMenu name={userName} />
          </header>
          <TripTabs variant="row" />
          <PlanBanner billing={billing} />
          <OfflineSupport enabled={offlineAllowed(billing, activeTripId)} />
        </div>

        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>

        {/* A trip shared with the person refreshes on its own; the owner's when they come back to the tab. */}
        <TripRefresh shared={activeTrip !== undefined && activeTrip.role !== 'owner'} />
        <ReferralClaim />
        {pipEnabled ? <PipFab /> : null}
        <BottomBar />
      </div>
    </PipLookProvider>
  );
}
