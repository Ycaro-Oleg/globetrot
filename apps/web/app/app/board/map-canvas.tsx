'use client';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  Marker as MapLibreMarker,
} from 'maplibre-gl';
import {
  arcBetween,
  distanceKm,
  SPOT_ICONS,
  LEG_ICONS,
  partialLine,
  type KitTab,
  type RouteStop,
  type SpotKind,
} from './board-route';
import { PIN, relabel, restyle, styleCountries, type MapStyleName } from './map-styles';
import styles from './world-map.module.css';
import { fitPadding } from './fit-padding';

export type Inset = { top: number; right: number; bottom: number; left: number };
export type NearbyPlace = { name: string; kind: string; longitude: number; latitude: number };

/** What the board can ask of the map once it is ready. */
export type BoardMapController = {
  flyTo(longitude: number, latitude: number, zoom?: number): void;
  fitStops(animate: boolean): void;
  fitWorld(): void;
  /** Frames a few places (a city's spots), never closer than street level, clear of `left` px on the left. */
  fitPoints(points: [number, number][], left?: number): void;
  zoomBy(delta: 1 | -1): void;
  center(): { longitude: number; latitude: number };
  /** Screen position of a place inside the map box, or null when the map is not ready. */
  project(longitude: number, latitude: number): { x: number; y: number } | null;
  /** Named points of interest drawn near a stop (from the tiles already on screen). */
  nearby(longitude: number, latitude: number, locale: string): NearbyPlace[];
  zoom(): number;
  /** Calls back once the map has stopped moving and drawn every tile. */
  onceIdle(callback: () => void): void;
};

/** A stop as the map draws it: its name already in the reader's language, and the counts on its petals. */
export type MapStop = RouteStop & { label: string; counts: Record<KitTab, string> };

type Props = {
  stops: MapStop[];
  /** Spots Pip offers for a stop's card, drawn dashed and see-through until the person keeps them. */
  pencilledSpots: readonly { name: string; kind: SpotKind; latitude: number; longitude: number }[];
  /** Pip's suggested stops, drawn dashed and see-through until the person applies them. */
  pencilled: readonly { name: string; latitude: number; longitude: number; nights: number }[];
  /** Where the person's trips start (their home city from the city list), drawn as a house and a dashed leg. */
  home: { name: string; latitude: number; longitude: number } | null;
  selectedId: string | null;
  styleName: MapStyleName;
  locale: string;
  tool: 'select' | 'pin';
  visitedCountries: readonly string[];
  /** Room the floating panels take over the map, so fits and labels avoid them. */
  inset: Inset;
  phone: boolean;
  apiKey: string;
  text: {
    map: string;
    loading: string;
    error: string;
    petal: Record<KitTab, string>;
    stop: (name: string, index: number) => string;
    /** The hint over a pin on hover or focus: "Tap to plan Hakone". */
    tip: (name: string) => string;
    /** How many things a stop holds, for the pin's name: "5 things". */
    items: (count: number) => string;
    /** A mini-pin's name: "Lake Ashi, sight, in Hakone". */
    spot: (name: string, kind: SpotKind, place: string) => string;
    pencilled: (name: string) => string;
    home: (name: string) => string;
  };
  controllerRef: MutableRefObject<BoardMapController | null>;
  onSelect: (id: string) => void;
  onOpenCard: (id: string, tab: KitTab | null) => void;
  /** A mini-pin was tapped: open its stop's card on that spot. */
  onOpenSpot: (stopId: string, index: number) => void;
  onPin: (longitude: number, latitude: number, name: string | null) => void;
  onZoom: (zoom: number) => void;
  onMove: () => void;
};

type PinMarker = {
  marker: MapLibreMarker;
  el: HTMLDivElement;
  drop: HTMLSpanElement;
  head: HTMLSpanElement;
  num: HTMLSpanElement;
  ring: HTMLSpanElement;
  label: HTMLSpanElement;
  button: HTMLButtonElement;
  /** How many things the stop holds (photos, spots, notes, to-dos), on the pin's head. */
  badge: HTMLSpanElement;
  tip: HTMLSpanElement;
  hideTimer?: number;
  name: string;
};

const DRAW_MS = 1100;
const COMET_MS = 2800;

function reducedMotion() {
  if (typeof window === 'undefined') return true;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** The moving cyan "comet": a gradient over the line's progress, its head at `p` (0..1 of the loop). */
function cometGradient(p: number) {
  const [r, g, b] = PIN.comet;
  const head = p * 1.5 - 0.25;
  const tail = head - 0.32;
  const alpha = (x: number) => (x >= tail && x <= head ? ((x - tail) / (head - tail)) ** 2.2 : 0);
  let stops = [
    0,
    tail,
    tail + (head - tail) * 0.5,
    tail + (head - tail) * 0.8,
    head,
    head + 0.004,
    1,
  ]
    .filter((x) => x >= 0 && x <= 1)
    .sort((a, c) => a - c);
  stops = stops.filter((x, i) => i === 0 || x - stops[i - 1]! > 1e-4);
  const expression: unknown[] = ['interpolate', ['linear'], ['line-progress']];
  for (const x of stops) expression.push(x, `rgba(${r},${g},${b},${alpha(x).toFixed(3)})`);
  if (stops.length < 2) expression.push(1, `rgba(${r},${g},${b},0)`);
  return expression;
}

export function MapCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerClass = useRef<typeof MapLibreMarker | null>(null);
  const pins = useRef(new Map<string, PinMarker>());
  const legBadges = useRef<MapLibreMarker[]>([]);
  const spotMarks = useRef<MapLibreMarker[]>([]);
  /** Room a docked card takes on the left, for the next fit only. */
  const extraLeft = useRef(0);
  const pencilMarks = useRef<MapLibreMarker[]>([]);
  const homeMark = useRef<MapLibreMarker | null>(null);
  const segments = useRef(
    new Map<string, { coords: [number, number][]; born: number; mode: string }>(),
  );
  const routeDirty = useRef(false);
  const poiLayers = useRef<string[]>([]);
  const firstSync = useRef(true);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const { apiKey } = props;

  // Labels: shown from z4 (always for the selected stop); one that would collide or slide under the panel hides
  // or flips to the left. The selected stop wins.
  const updateLabels = () => {
    const map = mapRef.current;
    if (!map || !host.current) return;
    const { selectedId, inset } = latest.current;
    const zoom = map.getZoom();
    const right = host.current.getBoundingClientRect().right - inset.right;
    const boxes: DOMRect[] = [];
    const order = [...pins.current.entries()].sort(
      (a, b) => Number(b[0] === selectedId) - Number(a[0] === selectedId),
    );
    for (const [id, pin] of order) {
      if (zoom < 4 && id !== selectedId) {
        pin.label.style.display = 'none';
        continue;
      }
      pin.label.style.display = 'block';
      pin.label.style.left = '38px';
      pin.label.style.right = 'auto';
      let box = pin.label.getBoundingClientRect();
      if (box.right > right) {
        pin.label.style.left = 'auto';
        pin.label.style.right = '38px';
        box = pin.label.getBoundingClientRect();
      }
      const hit = boxes.some(
        (other) =>
          box.left < other.right + 4 &&
          box.right > other.left - 4 &&
          box.top < other.bottom + 2 &&
          box.bottom > other.top - 2,
      );
      if (hit && id !== selectedId) {
        pin.label.style.display = 'none';
        continue;
      }
      boxes.push(box);
    }
  };

  // Hover or focus lifts the pin and shows what a tap does; the contents live in the card, not around the pin.
  const showTip = (pin: PinMarker) => {
    pin.el.dataset.hover = 'true';
    pin.el.style.zIndex = '5';
  };
  const hideTip = (pin: PinMarker, id: string) => {
    delete pin.el.dataset.hover;
    pin.el.style.zIndex = latest.current.selectedId === id ? '3' : '1';
  };

  const makePin = (stop: MapStop): PinMarker => {
    const Marker = markerClass.current!;
    const el = document.createElement('div');
    el.className = styles.pin ?? '';
    el.setAttribute('role', 'group');
    const drop = document.createElement('span');
    drop.className = styles.pinDrop ?? '';
    const head = document.createElement('span');
    head.className = styles.pinHead ?? '';
    const num = document.createElement('span');
    num.className = styles.pinNum ?? '';
    head.append(num);
    drop.append(head);
    const ground = document.createElement('span');
    ground.className = styles.pinGround ?? '';
    const ring = document.createElement('span');
    ring.className = styles.pinRing ?? '';
    const label = document.createElement('span');
    label.className = styles.pinLabel ?? '';
    label.setAttribute('aria-hidden', 'true');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = styles.pinButton ?? '';
    const badge = document.createElement('span');
    badge.className = styles.pinBadge ?? '';
    badge.setAttribute('aria-hidden', 'true');
    head.append(badge);
    const tip = document.createElement('span');
    tip.className = styles.pinTip ?? '';
    tip.setAttribute('aria-hidden', 'true');
    const pin: PinMarker = {
      marker: null as unknown as MapLibreMarker,
      el,
      drop,
      head,
      num,
      ring,
      label,
      button,
      badge,
      tip,
      name: stop.label,
    };
    el.append(ground, ring, drop, label, tip, button);
    const show = () => {
      window.clearTimeout(pin.hideTimer);
      if (!latest.current.phone) showTip(pin);
    };
    const hide = () => {
      window.clearTimeout(pin.hideTimer);
      pin.hideTimer = window.setTimeout(() => hideTip(pin, stop.id), 120);
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focusin', show);
    el.addEventListener('focusout', hide);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      latest.current.onOpenCard(stop.id, null);
    });
    pin.marker = new Marker({ element: el, anchor: 'bottom' })
      .setLngLat([stop.longitude, stop.latitude])
      .addTo(mapRef.current!);
    return pin;
  };

  const dropIn = (pin: PinMarker, delay: number) => {
    if (reducedMotion() || !pin.drop.animate) return;
    pin.drop.animate(
      [
        { transform: 'translateY(-80px) scale(.9)', opacity: 0 },
        { transform: 'translateY(0) scale(1,1)', opacity: 1, offset: 0.62 },
        { transform: 'translateY(0) scale(1.08,.9)', offset: 0.74 },
        { transform: 'translateY(-7px) scale(.98,1.03)', offset: 0.86 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 820, delay, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'backwards' },
    );
    pin.ring.animate(
      [
        { transform: 'scale(.4)', opacity: 0.95 },
        { transform: 'scale(4.2)', opacity: 0 },
      ],
      { duration: 760, delay: delay + 500, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
  };

  const syncPins = () => {
    const map = mapRef.current;
    if (!map || !markerClass.current) return;
    const { stops, selectedId, text } = latest.current;
    const initial = firstSync.current;
    firstSync.current = false;
    const ids = new Set(stops.map((stop) => stop.id));
    for (const [id, pin] of pins.current) {
      if (!ids.has(id)) {
        pin.marker.remove();
        pins.current.delete(id);
      }
    }
    stops.forEach((stop, index) => {
      let pin = pins.current.get(stop.id);
      if (!pin) {
        pin = makePin(stop);
        pins.current.set(stop.id, pin);
        dropIn(pin, initial ? 300 + index * 160 : 0);
      }
      const selected = stop.id === selectedId;
      pin.name = stop.label;
      pin.head.dataset.state = selected ? 'selected' : stop.visited ? 'visited' : 'planned';
      pin.num.textContent = stop.visited && !selected ? '✓' : String(index + 1);
      pin.label.textContent = stop.label;
      const total =
        stop.photos.length + stop.spots.length + stop.todos.length + (stop.note.trim() ? 1 : 0);
      pin.button.setAttribute(
        'aria-label',
        total > 0
          ? `${text.stop(stop.label, index + 1)} · ${text.items(total)}`
          : text.stop(stop.label, index + 1),
      );
      pin.button.setAttribute('aria-pressed', String(selected));
      pin.el.setAttribute('aria-label', stop.label);
      pin.el.style.zIndex = selected ? '3' : '1';
      pin.badge.textContent = total > 0 ? String(total) : '';
      pin.badge.style.display = total > 0 ? 'flex' : 'none';
      pin.tip.textContent = text.tip(stop.label);
      pin.marker.setLngLat([stop.longitude, stop.latitude]);
    });
    updateLabels();
  };

  const rebuildRoute = (initial: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const { stops } = latest.current;
    const now = performance.now();
    const reduced = reducedMotion();
    const previous = segments.current;
    const next = new Map<string, { coords: [number, number][]; born: number; mode: string }>();
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]!;
      const b = stops[i + 1]!;
      const key = `${a.id}>${b.id}`;
      const old = previous.get(key);
      next.set(key, {
        coords: arcBetween(a, b, 120),
        born: reduced ? now - 2 * DRAW_MS : (old?.born ?? now + (initial ? 900 + i * 420 : 150)),
        mode: a.legMode ?? 'none',
      });
    }
    segments.current = next;
    routeDirty.current = true;
    // Mode badges at the middle of each leg (decoration: the route list says the same in words).
    const Marker = markerClass.current;
    legBadges.current.forEach((marker) => marker.remove());
    legBadges.current = [];
    if (!Marker) return;
    stops.slice(0, -1).forEach((stop, i) => {
      if (!stop.legMode) return;
      const arc = next.get(`${stop.id}>${stops[i + 1]!.id}`)!.coords;
      const badge = document.createElement('span');
      badge.className = styles.legBadge ?? '';
      badge.setAttribute('aria-hidden', 'true');
      // The mode and the straight-line distance, where the leg is (the route list says it in words).
      const km = new Intl.NumberFormat(latest.current.locale, {
        style: 'unit',
        unit: 'kilometer',
        maximumFractionDigits: 0,
      }).format(distanceKm(stop, stops[i + 1]!));
      const icon = document.createElement('span');
      icon.textContent = LEG_ICONS[stop.legMode];
      const distance = document.createElement('span');
      distance.className = styles.legDistance ?? '';
      distance.textContent = km;
      badge.append(icon, distance);
      legBadges.current.push(
        new Marker({ element: badge }).setLngLat(arc[Math.floor(arc.length / 2)]!).addTo(map),
      );
    });
  };

  /**
   * Every stop's spots that have a place, as mini-pins with the mark of their kind. They show from z11 (the
   * city pin's badge counts them before that) and add their name from z13.5; a tap opens the card on that spot.
   */
  const updateSpots = () => {
    const map = mapRef.current;
    const Marker = markerClass.current;
    spotMarks.current.forEach((marker) => marker.remove());
    spotMarks.current = [];
    if (!map || !Marker) return;
    const { stops, selectedId, text } = latest.current;
    const lines: {
      type: 'Feature';
      properties: object;
      geometry: { type: 'LineString'; coordinates: [number, number][] };
    }[] = [];
    for (const stop of stops) {
      let letter = 0;
      if (stop.spotRoute) {
        const coordinates = stop.spots
          .filter((spot) => spot.latitude !== null && spot.longitude !== null)
          .map((spot) => [spot.longitude!, spot.latitude!] as [number, number]);
        if (coordinates.length >= 2)
          lines.push({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          });
      }
      stop.spots.forEach((spot, index) => {
        if (spot.latitude === null || spot.longitude === null) return;
        const mark = stop.spotRoute ? String.fromCharCode(65 + (letter++ % 26)) : null;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = styles.spotPin ?? '';
        el.dataset.kind = spot.kind;
        if (spot.done) el.dataset.done = 'true';
        if (stop.id === selectedId) el.dataset.current = 'true';
        el.setAttribute('aria-label', text.spot(spot.name, spot.kind, stop.label));
        const icon = document.createElement('span');
        icon.className = styles.spotPinIcon ?? '';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = SPOT_ICONS[spot.kind];
        const label = document.createElement('span');
        label.className = styles.spotPinLabel ?? '';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = spot.name;
        if (mark) {
          const badge = document.createElement('span');
          badge.className = styles.spotPinLetter ?? '';
          badge.setAttribute('aria-hidden', 'true');
          badge.textContent = mark;
          el.append(badge);
          el.setAttribute('aria-label', `${mark}. ${text.spot(spot.name, spot.kind, stop.label)}`);
        }
        el.append(icon, label);
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          latest.current.onOpenSpot(stop.id, index);
        });
        spotMarks.current.push(
          new Marker({ element: el, anchor: 'center' })
            .setLngLat([spot.longitude, spot.latitude])
            .addTo(map),
        );
      });
    }
    // Pip's offers for the open card: the same mini-pins, dashed and see-through, not yet the person's.
    for (const spot of latest.current.pencilledSpots) {
      const el = document.createElement('span');
      el.className = styles.spotPin ?? '';
      el.dataset.kind = spot.kind;
      el.dataset.pencil = 'true';
      el.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('span');
      icon.className = styles.spotPinIcon ?? '';
      icon.textContent = SPOT_ICONS[spot.kind];
      const label = document.createElement('span');
      label.className = styles.spotPinLabel ?? '';
      label.textContent = spot.name;
      el.append(icon, label);
      spotMarks.current.push(
        new Marker({ element: el, anchor: 'center' })
          .setLngLat([spot.longitude, spot.latitude])
          .addTo(map),
      );
    }
    (map.getSource('gt-spot-route') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: lines,
    });
  };

  /** How close the map is, for the mini-pins: hidden far away, marks near, marks and names close up. */
  const spotScale = (zoom: number) => {
    if (host.current)
      host.current.dataset.spots = zoom < 11 ? 'off' : zoom < 13.5 ? 'marks' : 'names';
  };

  const tripCountries = () => [
    ...new Set(latest.current.stops.map((stop) => stop.countryCode).filter(Boolean)),
  ];

  const padding = () => {
    const { inset } = latest.current;
    const container = mapRef.current?.getContainer();
    return fitPadding(
      {
        top: inset.top + 30,
        right: inset.right + 30,
        bottom: inset.bottom + 30,
        left: Math.max(inset.left, extraLeft.current) + 30,
      },
      container?.clientWidth ?? 0,
      container?.clientHeight ?? 0,
    );
  };

  /**
   * Fits the camera to `bounds`. MapLibre adds the padding kept from the last camera move to the new one, so a
   * second fit (the route after the world) could ask for twice the panel's room and be refused: the map stayed on
   * Europe for a fresh Japan trip on phones. Clearing it first makes each fit use only its own padding.
   */
  const fit = (
    map: MapLibreMap,
    bounds: [[number, number], [number, number]],
    options: Omit<Parameters<MapLibreMap['fitBounds']>[1] & object, 'padding'>,
  ) => {
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    map.fitBounds(bounds, { ...options, padding: padding() });
  };

  useEffect(() => {
    if (!host.current || !apiKey) {
      setError(true);
      return;
    }
    let disposed = false;
    let map: MapLibreMap | null = null;
    let frame = 0;
    let moveFrame = 0;
    void import('maplibre-gl')
      .then(({ Map, Marker, setWorkerUrl }) => {
        if (disposed || !host.current) return;
        setWorkerUrl(
          new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString(),
        );
        markerClass.current = Marker;
        map = new Map({
          container: host.current,
          style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(apiKey)}`,
          center: [40, 22],
          zoom: 1.4,
          minZoom: 0.6,
          maxZoom: 19,
          renderWorldCopies: false,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;

        let setupDone = false;
        const finishSetup = () => {
          if (disposed || !map || setupDone || !map.getStyle()?.layers) return;
          setupDone = true;
          window.clearTimeout(loadTimeout);
          const empty = { type: 'FeatureCollection' as const, features: [] };
          const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
          const width = (a: number, b: number, c: number) => [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            a,
            6,
            b,
            13,
            c,
          ];
          map.addSource('gt-route', { type: 'geojson', lineMetrics: true, data: empty });
          map.addLayer(
            {
              id: 'gt-route-casing',
              type: 'line',
              source: 'gt-route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-width': width(4.5, 7, 11) as never, 'line-color': '#F8F9FA' },
            },
            firstSymbol,
          );
          // The leg's way of travel shows in the line itself: a flight is an airmail dash, a walk a dotted
          // line, a boat a long dash; train, bus and car a solid line.
          const dashed = ['flight', 'walk', 'boat'];
          map.addLayer(
            {
              id: 'gt-route-core',
              type: 'line',
              source: 'gt-route',
              filter: ['!', ['in', ['get', 'mode'], ['literal', dashed]]],
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-width': width(1.8, 3, 4.5) as never, 'line-color': PIN.route },
            },
            firstSymbol,
          );
          (
            [
              ['flight', [2.2, 1.4]],
              ['walk', [0.1, 1.8]],
              ['boat', [3.5, 1.6]],
            ] as const
          ).forEach(([mode, dash]) =>
            map!.addLayer(
              {
                id: `gt-route-${mode}`,
                type: 'line',
                source: 'gt-route',
                filter: ['==', ['get', 'mode'], mode],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                  'line-width': width(1.8, 3, 4.5) as never,
                  'line-color': PIN.route,
                  'line-dasharray': [...dash],
                },
              },
              firstSymbol,
            ),
          );
          // A city's own route between its spots (A, B, C…): a thin dashed line, only once spots show.
          map.addSource('gt-spot-route', { type: 'geojson', data: empty });
          map.addLayer({
            id: 'gt-spot-route',
            type: 'line',
            source: 'gt-spot-route',
            minzoom: 11,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': PIN.ink,
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 16, 3] as never,
              'line-dasharray': [1.5, 1.5],
              'line-opacity': 0.8,
            },
          });
          // Which way the trip goes: small chevrons along every leg.
          map.addLayer({
            id: 'gt-route-arrows',
            type: 'symbol',
            source: 'gt-route',
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 1, 70, 8, 140] as never,
              'text-field': '›',
              'text-font': ['Noto Sans Bold'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 1, 13, 8, 19] as never,
              'text-keep-upright': false,
              'text-rotation-alignment': 'map',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#FFFFFF',
              'text-halo-color': PIN.route,
              'text-halo-width': 1.2,
            },
          });
          map.addLayer(
            {
              id: 'gt-route-comet',
              type: 'line',
              source: 'gt-route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-width': width(3.5, 6, 9) as never,
                'line-blur': 0.6,
                'line-gradient': cometGradient(0) as never,
                'line-opacity': reducedMotion() ? 0 : 1,
              },
            },
            firstSymbol,
          );
          poiLayers.current = restyle(map, latest.current.styleName);
          relabel(map, latest.current.locale);
          // Country fills come from a small Natural Earth file served by the app (public domain).
          void fetch('/geo/countries-110m.json')
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
              if (!data || disposed || !map || map.getSource('gt-countries')) return;
              map.addSource('gt-countries', { type: 'geojson', data });
              const water = map
                .getStyle()
                .layers.find((layer) => layer.type === 'fill' && /water|ocean/.test(layer.id))?.id;
              map.addLayer(
                {
                  id: 'gt-countries-fill',
                  type: 'fill',
                  source: 'gt-countries',
                  paint: { 'fill-color': '#000', 'fill-opacity': 0 },
                },
                water,
              );
              map.addLayer(
                {
                  id: 'gt-countries-trip',
                  type: 'line',
                  source: 'gt-countries',
                  filter: ['in', ['get', 'iso'], ['literal', ['__']]],
                  layout: { 'line-join': 'round' },
                  paint: {
                    'line-color': PIN.route,
                    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 2] as never,
                    'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.9, 6, 0.55] as never,
                  },
                },
                water,
              );
              styleCountries(
                map,
                latest.current.styleName,
                tripCountries(),
                latest.current.visitedCountries,
              );
            })
            .catch(() => undefined);

          setError(false);
          setReady(true);
          syncPins();
          rebuildRoute(true);
          updateSpots();
          fit(
            map,
            [
              [-170, -50],
              [170, 70],
            ],
            { duration: 0 },
          );
          if (latest.current.stops.length) controller.fitStops(false);
          frame = requestAnimationFrame(tick);
        };

        const tick = (now: number) => {
          const current = mapRef.current;
          const source = current?.getSource('gt-route') as GeoJSONSource | undefined;
          if (current && source) {
            try {
              let animating = false;
              const features = [];
              for (const segment of segments.current.values()) {
                const p = Math.min(1, Math.max(0, (now - segment.born) / DRAW_MS));
                if (p < 1) animating = true;
                if (p <= 0) continue;
                const eased = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
                features.push({
                  type: 'Feature' as const,
                  properties: { mode: segment.mode },
                  geometry: {
                    type: 'LineString' as const,
                    coordinates: partialLine(segment.coords, eased),
                  },
                });
              }
              if (animating || routeDirty.current) {
                source.setData({ type: 'FeatureCollection', features });
                routeDirty.current = animating;
              }
              if (!reducedMotion()) {
                current.setPaintProperty(
                  'gt-route-comet',
                  'line-gradient',
                  cometGradient((now % COMET_MS) / COMET_MS) as never,
                );
              }
            } catch {
              /* A frame can race the style being replaced; the next one catches up. */
            }
          }
          frame = requestAnimationFrame(tick);
        };

        let loadTimeout = 0;
        map.on('load', finishSetup);
        map.on('style.load', finishSetup);
        map.on('idle', finishSetup);
        map.on('error', (event) => {
          const name = (event.error as { name?: string } | undefined)?.name;
          if (!disposed && name === 'WebGLNotSupportedError') setError(true);
        });
        map.on('click', (event) => {
          if (latest.current.tool !== 'pin' || latest.current.phone) return;
          const point = event.point;
          const feature = map!
            .queryRenderedFeatures([
              [point.x - 8, point.y - 8],
              [point.x + 8, point.y + 8],
            ])
            .find(
              (candidate) =>
                candidate.layer.type === 'symbol' &&
                candidate.properties?.name &&
                !/shield|housenumber/.test(candidate.layer.id) &&
                !candidate.layer.id.startsWith('gt-'),
            );
          latest.current.onPin(
            event.lngLat.lng,
            event.lngLat.lat,
            nameOf(feature, latest.current.locale),
          );
        });
        map.on('moveend', updateLabels);
        map.on('zoom', () => {
          spotScale(map!.getZoom());
          latest.current.onZoom(map!.getZoom());
          updateLabels();
        });
        map.on('move', () => {
          if (moveFrame) return;
          moveFrame = requestAnimationFrame(() => {
            moveFrame = 0;
            latest.current.onMove();
          });
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

    const controller: BoardMapController = {
      flyTo(longitude, latitude, zoom) {
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: zoom ?? Math.max(mapRef.current.getZoom(), 15),
          speed: 0.85,
          curve: 1.45,
          padding: padding(),
          essential: true,
        });
      },
      fitStops(animate) {
        const current = mapRef.current;
        const stops = latest.current.stops;
        if (!current || !stops.length) return;
        // With a single stop the trip is "home to there": show both. With a route, the route.
        const home = stops.length === 1 ? latest.current.home : null;
        const lngs = [...stops.map((stop) => stop.longitude), ...(home ? [home.longitude] : [])];
        const lats = [...stops.map((stop) => stop.latitude), ...(home ? [home.latitude] : [])];
        const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
        const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
        if (sw[0] === ne[0] && sw[1] === ne[1]) {
          current.jumpTo({ center: sw, zoom: 11 });
          return;
        }
        fit(current, [sw, ne], {
          maxZoom: 9,
          duration: animate && !reducedMotion() ? 1600 : 0,
          essential: true,
        });
      },
      fitWorld() {
        const current = mapRef.current;
        if (!current) return;
        fit(
          current,
          [
            [-170, -50],
            [170, 70],
          ],
          { duration: reducedMotion() ? 0 : 1200, essential: true },
        );
      },
      fitPoints(points, left = 0) {
        const current = mapRef.current;
        if (!current || !points.length) return;
        extraLeft.current = left;
        const lngs = points.map(([lng]) => lng);
        const lats = points.map(([, lat]) => lat);
        fit(
          current,
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { maxZoom: 16, duration: reducedMotion() ? 0 : 1000, essential: true },
        );
        extraLeft.current = 0;
      },
      zoomBy(delta) {
        const current = mapRef.current;
        if (!current) return;
        if (delta > 0) current.zoomIn({ duration: 400 });
        else current.zoomOut({ duration: 400 });
      },
      center() {
        const center = mapRef.current?.getCenter();
        return { longitude: center?.lng ?? 0, latitude: center?.lat ?? 0 };
      },
      project(longitude, latitude) {
        const point = mapRef.current?.project([longitude, latitude]);
        return point ? { x: point.x, y: point.y } : null;
      },
      nearby(longitude, latitude, locale) {
        const current = mapRef.current;
        if (!current) return [];
        const layers = poiLayers.current.filter((id) => current.getLayer(id));
        const features = layers.length ? current.queryRenderedFeatures({ layers }) : [];
        const distance = (feature: MapGeoJSONFeature) => {
          const [x, y] = (feature.geometry as { coordinates: number[] }).coordinates as [
            number,
            number,
          ];
          return (x - longitude) ** 2 + (y - latitude) ** 2;
        };
        const seen = new Set<string>();
        const list: NearbyPlace[] = [];
        features
          .filter((feature) => feature.properties?.name && feature.geometry.type === 'Point')
          .sort((a, b) => distance(a) - distance(b))
          .forEach((feature) => {
            const name = nameOf(feature, locale)!;
            if (seen.has(name) || list.length >= 7) return;
            seen.add(name);
            const [x, y] = (feature.geometry as { coordinates: number[] }).coordinates as [
              number,
              number,
            ];
            list.push({
              name,
              kind: String(feature.properties.subclass ?? feature.properties.class ?? ''),
              longitude: x,
              latitude: y,
            });
          });
        return list;
      },
      zoom() {
        return mapRef.current?.getZoom() ?? 1.4;
      },
      onceIdle(callback) {
        const current = mapRef.current;
        if (!current) return;
        // Wait for the fly to finish first: an "idle" before it starts would be too early.
        current.once('moveend', () => current.once('idle', callback));
      },
    };
    latest.current.controllerRef.current = controller;

    const resize = new ResizeObserver(() => mapRef.current?.resize());
    resize.observe(host.current);
    const allPins = pins.current;
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(moveFrame);
      resize.disconnect();
      allPins.forEach((pin) => pin.marker.remove());
      allPins.clear();
      legBadges.current.forEach((marker) => marker.remove());
      legBadges.current = [];
      latest.current.controllerRef.current = null;
      map?.remove();
      mapRef.current = null;
      markerClass.current = null;
      firstSync.current = true;
    };
    // The map is built once per key; every other prop is read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const { stops, selectedId, styleName, locale, tool, visitedCountries, inset, pencilled } = props;

  // Pip's suggested stops: dashed, see-through pins with their name, until the proposal is applied. The route
  // panel lists the same suggestions in words, so these are decoration for pointer and screen alike.
  useEffect(() => {
    const map = mapRef.current;
    const Marker = markerClass.current;
    pencilMarks.current.forEach((marker) => marker.remove());
    pencilMarks.current = [];
    if (!ready || !map || !Marker) return;
    for (const stop of pencilled) {
      const el = document.createElement('div');
      el.className = styles.pencilPin ?? '';
      el.setAttribute('aria-hidden', 'true');
      el.title = latest.current.text.pencilled(stop.name);
      const head = document.createElement('span');
      head.className = styles.pencilHead ?? '';
      head.textContent = '✎';
      const label = document.createElement('span');
      label.className = styles.pencilLabel ?? '';
      label.textContent = stop.name;
      el.append(head, label);
      pencilMarks.current.push(
        new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([stop.longitude, stop.latitude])
          .addTo(map),
      );
    }
    return () => {
      pencilMarks.current.forEach((marker) => marker.remove());
      pencilMarks.current = [];
    };
  }, [ready, pencilled]);

  // Home: a house where the person's trips start, and a dashed leg to the first stop.
  const { home } = props;
  const firstStop = stops[0];
  useEffect(() => {
    const map = mapRef.current;
    const Marker = markerClass.current;
    homeMark.current?.remove();
    homeMark.current = null;
    if (!ready || !map || !Marker) return;
    const line = {
      type: 'FeatureCollection' as const,
      features:
        home && firstStop
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: [
                    [home.longitude, home.latitude],
                    [firstStop.longitude, firstStop.latitude],
                  ],
                },
              },
            ]
          : [],
    };
    const source = map.getSource('gt-home') as GeoJSONSource | undefined;
    if (source) source.setData(line);
    else {
      map.addSource('gt-home', { type: 'geojson', data: line });
      map.addLayer({
        id: 'gt-home-leg',
        type: 'line',
        source: 'gt-home',
        paint: {
          'line-color': '#0f172a',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.6,
        },
      });
    }
    if (!home) return;
    const el = document.createElement('div');
    el.className = styles.homePin ?? '';
    el.setAttribute('aria-hidden', 'true');
    el.title = latest.current.text.home(home.name);
    const head = document.createElement('span');
    head.className = styles.homeHead ?? '';
    head.textContent = '⌂';
    const label = document.createElement('span');
    label.className = styles.homeLabel ?? '';
    label.textContent = latest.current.text.home(home.name);
    el.append(head, label);
    homeMark.current = new Marker({ element: el, anchor: 'bottom' })
      .setLngLat([home.longitude, home.latitude])
      .addTo(map);
    return () => {
      homeMark.current?.remove();
      homeMark.current = null;
    };
  }, [ready, home, firstStop]);

  useEffect(() => {
    if (!ready) return;
    syncPins();
    rebuildRoute(false);
    updateSpots();
    if (mapRef.current) {
      styleCountries(mapRef.current, latest.current.styleName, tripCountries(), visitedCountries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stops, visitedCountries]);

  useEffect(() => {
    if (!ready) return;
    syncPins();
    updateSpots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  // Pip's offers come and go with the card: redraw the mini-pins when they change.
  const { pencilledSpots } = props;
  useEffect(() => {
    if (!ready) return;
    updateSpots();
  }, [ready, pencilledSpots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    poiLayers.current = restyle(map, styleName);
    styleCountries(map, styleName, tripCountries(), latest.current.visitedCountries);
  }, [ready, styleName]);

  useEffect(() => {
    if (ready && mapRef.current) relabel(mapRef.current, locale);
  }, [ready, locale]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (ready && canvas) canvas.style.cursor = tool === 'pin' ? 'crosshair' : '';
  }, [ready, tool]);

  useEffect(() => {
    if (ready) updateLabels();
  }, [ready, inset.right]);

  return (
    <div className={styles.mapHost}>
      <div
        ref={host}
        className={styles.mapCanvas}
        role="region"
        aria-label={props.text.map}
        data-spots="off"
      />
      {!ready && !error ? <div className={styles.mapLoading}>{props.text.loading}</div> : null}
      {error ? <div className={styles.mapError}>{props.text.error}</div> : null}
    </div>
  );
}

function nameOf(feature: MapGeoJSONFeature | undefined, locale: string): string | null {
  if (!feature?.properties) return null;
  const lang = locale.split('-')[0];
  const value =
    feature.properties[`name:${lang}`] ??
    feature.properties['name:latin'] ??
    feature.properties.name;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
