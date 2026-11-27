'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isTripPage } from './nav-model';

/** How often a shared trip's screens fetch the latest plan while the tab is visible. */
const EVERY_MS = 30_000;

/**
 * Keeps a trip's screens current when other people plan it too (ADR-0024): the latest version is fetched when
 * the person comes back to the tab and, on a shared trip, every 30 seconds while the tab is visible. There is
 * no live sync yet; what someone is typing is kept (only the server data refreshes).
 */
export function TripRefresh({ shared }: { shared: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const onTrip = isTripPage(pathname) || pathname.startsWith('/app/trips/');
  useEffect(() => {
    if (!onTrip) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', refresh);
    const timer = shared ? window.setInterval(refresh, EVERY_MS) : undefined;
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [onTrip, shared, router]);
  return null;
}
