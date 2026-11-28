'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { RouteStop } from '../../board/board-route';
import { TRIP_HOME } from '../../_components/nav-model';
import { SidebarDrawer, useDrawer } from './sidebar-drawer';
import { useSections } from './sections-state';
import { ExpandMapLink, TripJumpBar, TripSidebar, type WorkspaceDay } from './trip-sidebar';
import styles from './workspace.module.css';

/** The map and MapLibre load only on a screen wide enough to show them beside the document. */
const TripMapPane = dynamic(() => import('./trip-map-pane').then((module) => module.TripMapPane), {
  ssr: false,
});

const WIDE = '(min-width: 1100px)';

/** Whether the screen is wide enough for the map beside the document; false until the browser says so. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.(WIDE);
    if (!query) return;
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * The day heading nearest the top of the screen in the trip's document (`id="day-N"`, from the itinerary), so the
 * sidebar can mark it and the map can follow it.
 */
function useActiveDay(enabled: boolean): number | null {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;
    const headings = Array.from(document.querySelectorAll<HTMLElement>('[id^="day-"]')).filter(
      (element) => /^day-\d+$/.test(element.id),
    );
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(Number(visible.target.id.slice(4)));
      },
      // A band across the upper part of the screen: the day whose heading is in it is the one being read.
      { rootMargin: '-15% 0px -60% 0px' },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [enabled]);
  return active;
}

/**
 * The trip workspace: the trip's sections on the left (a drawer that folds away and resizes), the page in the middle (the trip's document, the budget or
 * the checklists) and, from 1100 px, the map on the right. Below 1100 the map is a button that opens the full
 * map; below 720 the sidebar becomes a row of sections.
 */
export function TripWorkspace({
  trip,
  days,
  stops,
  children,
}: {
  trip: { readonly id: string; readonly title: string } | null;
  days: readonly WorkspaceDay[];
  stops: readonly RouteStop[];
  children: ReactNode;
}) {
  const t = useTranslations('workspace');
  const pathname = usePathname();
  const router = useRouter();
  const wide = useWide();
  const onHome = pathname === TRIP_HOME;
  const activeDay = useActiveDay(onHome);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useDrawer();
  const [sections, setSection] = useSections();
  const focusStopId = days.find((day) => day.index === activeDay)?.stopId ?? null;

  /** A pin was chosen: show that stop in the document's places. */
  const select = (stopId: string) => {
    setSelected(stopId);
    const target = document.getElementById(`stop-${stopId}`);
    if (onHome && target) {
      target.scrollIntoView({ block: 'center' });
      target.focus({ preventScroll: true });
    } else {
      router.push(`${TRIP_HOME}#stop-${stopId}`);
    }
  };

  return (
    <div
      className={styles.workspace}
      data-workspace-map={wide && trip ? '' : undefined}
      // The drawer's width drives the first column; folded, it is a thin rail with the button to open it.
      style={{ '--sidebar-width': drawer.open ? `${drawer.width}px` : '56px' } as CSSProperties}
    >
      <SidebarDrawer state={drawer} onChange={setDrawer} footer={<ExpandMapLink />}>
        <TripSidebar
          tripTitle={trip?.title ?? null}
          days={days}
          pathname={pathname}
          activeDay={activeDay}
          itineraryOpen={sections.itinerary}
          onItineraryOpen={(open) => setSection('itinerary', open)}
        />
      </SidebarDrawer>
      <div className={styles.content}>
        <TripJumpBar pathname={pathname} />
        {children}
      </div>
      {wide && trip ? (
        <TripMapPane
          stops={stops}
          focusStopId={focusStopId}
          selectedId={selected}
          onSelect={select}
        />
      ) : null}
      {!wide && trip ? (
        <Link href="/app/board" className={styles.mapButton}>
          <span aria-hidden="true">◎</span> {t('openMap')}
        </Link>
      ) : null}
    </div>
  );
}
