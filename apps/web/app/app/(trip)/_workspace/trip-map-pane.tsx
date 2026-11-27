'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KIT_TABS, type KitTab, type RouteStop } from '../../board/board-route';
import { MapCanvas, type BoardMapController, type MapStop } from '../../board/map-canvas';
import { kitCounts } from '../../board/pin-card';
import boardStyles from '../../board/world-map.module.css';
import styles from './workspace.module.css';

const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
const NONE: readonly never[] = [];
const NO_INSET = { top: 16, right: 16, bottom: 16, left: 16 };
/** How close the map comes when it follows the day being read: a city and its surroundings. */
const DAY_ZOOM = 7;

/**
 * The trip's map beside its document (from 1100 px): the stops and the routes between them, following the day
 * being read. It only looks and points; adding stops, nights and legs happens on the full map ("Expand map"). The
 * document never depends on it: every stop and day is in the list too.
 */
export function TripMapPane({
  stops,
  focusStopId,
  selectedId,
  onSelect,
}: {
  stops: readonly RouteStop[];
  /** The stop of the day being read; the map flies there when it changes. */
  focusStopId: string | null;
  selectedId: string | null;
  onSelect: (stopId: string) => void;
}) {
  const t = useTranslations('mapBoard');
  const tw = useTranslations('workspace');
  const locale = useLocale();
  const controller = useRef<BoardMapController | null>(null);

  const mapStops: MapStop[] = useMemo(
    () => stops.map((stop) => ({ ...stop, label: stop.name, counts: kitCounts(stop) })),
    [stops],
  );
  const petalNames = useMemo(
    () =>
      Object.fromEntries(KIT_TABS.map((tab) => [tab, t(`card.tabs.${tab}`)])) as Record<
        KitTab,
        string
      >,
    [t],
  );

  // Opened straight on a day (`#day-6`), the day is known before MapLibre is ready: the move waits for the map's
  // first fit, so that fit does not undo it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const stop = stops.find((candidate) => candidate.id === focusStopId);
    if (stop) controller.current?.flyTo(stop.longitude, stop.latitude, DAY_ZOOM);
  }, [ready, focusStopId, stops]);

  return (
    <div
      className={`${boardStyles.stage} ${styles.mapPane}`}
      role="region"
      aria-label={tw('mapRegion')}
    >
      <MapCanvas
        stops={mapStops}
        pencilled={NONE}
        pencilledSpots={NONE}
        home={null}
        selectedId={selectedId}
        styleName="atlas"
        locale={locale}
        tool="select"
        visitedCountries={NONE}
        inset={NO_INSET}
        phone={false}
        apiKey={API_KEY}
        // The document scrolls beside the map: the wheel scrolls it, Ctrl + wheel zooms the map.
        cooperative={{ windows: t('coopWindows'), mac: t('coopMac'), mobile: t('coopMobile') }}
        controllerRef={controller}
        text={{
          map: t('mapLabel'),
          loading: t('mapLoading'),
          error: t('mapError'),
          petal: petalNames,
          stop: (name, index) => t('stopAria', { place: name, index }),
          tip: (name) => t('pinTip', { place: name }),
          spot: (name, kind, place) =>
            t('spotAria', { name, kind: t(`card.kinds.${kind}`), place }),
          items: (count) => t('pinItems', { count }),
          pencilled: (name) => t('pip.pencilled', { name }),
          home: (name) => t('home', { name }),
        }}
        onSelect={onSelect}
        onOpenCard={(stopId) => onSelect(stopId)}
        onOpenSpot={(stopId) => onSelect(stopId)}
        onPin={() => undefined}
        onZoom={() => undefined}
        onMove={() => undefined}
        onReady={() => setReady(true)}
      />
      <Link href="/app/board" className={styles.expand}>
        <span aria-hidden="true">⤢</span> {tw('expandMap')}
      </Link>
    </div>
  );
}
