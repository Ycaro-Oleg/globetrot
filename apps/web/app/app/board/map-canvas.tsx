'use client';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { LegMode } from '@globetrot/domain';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import styles from './world-map.module.css';

/** One leg of the route: the stop it leaves, the next stop, and how it is travelled (null: not decided). */
export type MapLeg = { from: MapPlace; to: MapPlace; mode: LegMode | null };

export type MapPlace = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  longitude: number;
  latitude: number;
};

type MapCanvasProps = {
  route: MapPlace[];
  legs: MapLeg[];
  /** Icon per leg mode, shown at the middle of each leg (decoration: the stop list says the same in words). */
  legIcons: Record<LegMode, string>;
  /** Filled in once the map is ready: reads the centre of the map (for "Pin here"). */
  centerRef?: MutableRefObject<(() => { longitude: number; latitude: number }) | null>;
  labels: { map: string; loading: string; error: string };
  selectedId: string | null;
  apiKey: string;
  onPlaceClick: (id: string) => void;
  onMapPin: (longitude: number, latitude: number) => void;
};

export function MapCanvas({
  route,
  legs,
  legIcons,
  centerRef,
  labels,
  selectedId,
  apiKey,
  onPlaceClick,
  onMapPin,
}: MapCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerConstructor = useRef<typeof MapLibreMarker | null>(null);
  const markerRefs = useRef<MapLibreMarker[]>([]);
  const legMarkerRefs = useRef<MapLibreMarker[]>([]);
  const placeClickRef = useRef(onPlaceClick);
  const mapPinRef = useRef(onMapPin);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    placeClickRef.current = onPlaceClick;
  }, [onPlaceClick]);
  useEffect(() => {
    mapPinRef.current = onMapPin;
  }, [onMapPin]);

  useEffect(() => {
    if (!host.current || !apiKey) {
      setError(true);
      return;
    }
    let disposed = false;
    let map: MapLibreMap | null = null;
    void import('maplibre-gl')
      .then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
        if (disposed || !host.current) return;
        setWorkerUrl(
          new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString(),
        );
        markerConstructor.current = Marker;
        map = new Map({
          container: host.current,
          style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(apiKey)}`,
          center: [12, 20],
          zoom: 1.45,
          minZoom: 1.1,
          maxZoom: 18,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.addControl(
          new NavigationControl({ showCompass: true, visualizePitch: true }),
          'top-right',
        );
        let setupDone = false;
        const finishSetup = () => {
          if (disposed || !map || setupDone) return;
          setupDone = true;
          window.clearTimeout(loadTimeout);
          setError(false);
          setReady(true);
          try {
            map.setProjection({ type: 'mercator' });
          } catch {
            /* Keep the default Mercator projection if it cannot be set. */
          }
          map.addSource('trip-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'trip-route-shadow',
            type: 'line',
            source: 'trip-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#FFF5E1', 'line-width': 7, 'line-opacity': 0.92 },
          });
          // One colour, a different pattern per kind of leg: the mode is never told by colour alone.
          const leg = (id: string, modes: string[], paint: Record<string, unknown>) =>
            map!.addLayer({
              id,
              type: 'line',
              source: 'trip-route',
              filter: ['in', ['get', 'mode'], ['literal', modes]],
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#E0401F', ...paint },
            });
          leg('trip-leg-flight', ['flight'], { 'line-width': 2.5, 'line-dasharray': [4, 2.5] });
          leg('trip-leg-ground', ['train', 'bus', 'car'], { 'line-width': 3.5 });
          leg('trip-leg-water', ['boat'], { 'line-width': 3, 'line-dasharray': [0.6, 1.6] });
          leg('trip-leg-other', ['walk', 'other', 'none'], {
            'line-width': 3,
            'line-dasharray': [2, 2],
          });
          if (centerRef) {
            centerRef.current = () => {
              const center = map!.getCenter();
              return { longitude: center.lng, latitude: center.lat };
            };
          }
          map.on('click', (event) => mapPinRef.current(event.lngLat.lng, event.lngLat.lat));
        };
        let loadTimeout = 0;
        map.on('load', finishSetup);
        map.on('style.load', finishSetup);
        map.on('idle', finishSetup);
        map.on('error', (event) => {
          const name = (event.error as { name?: string } | undefined)?.name;
          if (!disposed && name === 'WebGLNotSupportedError') setError(true);
        });
        loadTimeout = window.setTimeout(() => {
          if (map?.loaded()) finishSetup();
          else if (!disposed) setError(true);
        }, 15000);
        if (map.loaded()) finishSetup();
      })
      .catch(() => {
        if (!disposed) setError(true);
      });

    return () => {
      disposed = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      legMarkerRefs.current.forEach((marker) => marker.remove());
      legMarkerRefs.current = [];
      if (centerRef) centerRef.current = null;
      map?.remove();
      mapRef.current = null;
      markerConstructor.current = null;
    };
  }, [apiKey, centerRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource('trip-route') as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: legs.map((leg) => ({
        type: 'Feature' as const,
        properties: { mode: leg.mode ?? 'none' },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [leg.from.longitude, leg.from.latitude],
            [leg.to.longitude, leg.to.latitude],
          ],
        },
      })),
    });
    const Marker = markerConstructor.current;
    legMarkerRefs.current.forEach((marker) => marker.remove());
    legMarkerRefs.current = Marker
      ? legs
          .filter((leg) => leg.mode !== null)
          .map((leg) => {
            const badge = document.createElement('span');
            badge.className = styles.legMarker ?? '';
            badge.setAttribute('aria-hidden', 'true');
            badge.textContent = legIcons[leg.mode!];
            return new Marker({ element: badge })
              .setLngLat([
                (leg.from.longitude + leg.to.longitude) / 2,
                (leg.from.latitude + leg.to.latitude) / 2,
              ])
              .addTo(map);
          })
      : [];
  }, [ready, legs, legIcons]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = markerConstructor.current;
    if (!ready || !map || !Marker) return;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = route.map((place, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = styles.geoMarker ?? '';
      button.setAttribute('aria-label', `${index + 1}. ${place.name}`);
      button.setAttribute('aria-pressed', String(place.id === selectedId));
      button.title = place.name;
      const head = document.createElement('span');
      head.className = `${styles.pinHead} ${place.id === selectedId ? styles.pinHeadActive : ''}`;
      head.textContent = String(index + 1);
      button.append(head);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        placeClickRef.current(place.id);
      });
      return new Marker({ element: button, anchor: 'bottom' })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
    });
  }, [ready, route, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = route.find((place) => place.id === selectedId);
    if (ready && map && selected) {
      map.flyTo({
        center: [selected.longitude, selected.latitude],
        zoom: Math.max(map.getZoom(), 4.5),
        duration: 700,
      });
    }
  }, [ready, route, selectedId]);

  return (
    <div className={styles.maplibreHost}>
      <div
        ref={host}
        className={styles.maplibreCanvas}
        role="application"
        aria-label={labels.map}
      />
      {!ready && !error ? <div className={styles.mapLoading}>{labels.loading}</div> : null}
      {error ? <div className={styles.mapError}>{labels.error}</div> : null}
      <span className={styles.mapAttribution}>© OpenStreetMap contributors · Geoapify</span>
    </div>
  );
}
