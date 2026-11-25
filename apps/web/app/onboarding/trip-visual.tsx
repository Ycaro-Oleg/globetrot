'use client';

import { useEffect, useRef, useState } from 'react';
import { projectWorld, WORLD, WORLD_HEIGHT } from '../../lib/projection';
import styles from './onboarding.module.css';

type Point = { name: string; latitude: number; longitude: number };
type Box = [x: number, y: number, w: number, h: number];

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

type XY = { x: number; y: number };

/** How far the flight's arc bows up: like a route on a travel site. */
const bow = (a: XY, b: XY) => Math.max(14, Math.hypot(b.x - a.x, b.y - a.y) * 0.28);

function arc(a: XY, b: XY) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 - bow(a, b);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/**
 * The part of the world worth showing: both places with room around them, never narrower than a region, in the
 * panel's own shape and above whatever covers its lower part (the trip summary), so no pin hides behind it.
 */
function frame(points: XY[], aspect: number, clear: number): Box {
  const world: Box = [0, 0, WORLD.width, WORLD_HEIGHT];
  if (points.length === 0) {
    const h = WORLD_HEIGHT;
    const w = h * aspect;
    return w >= WORLD.width ? world : [(WORLD.width - w) / 2, 0, w, h];
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 60) * 1.5 + 50;
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 40) * 1.4 + 50;
  // The trip sits in the band between 12% from the top and the covered part.
  const band = Math.max(0.3, clear - 0.16);
  let h = spanY / band;
  let w = h * aspect;
  if (w < spanX) {
    w = spanX;
    h = w / aspect;
  }
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const top = Math.min(...ys) - (spanY - (Math.max(...ys) - Math.min(...ys))) / 2;
  const y = top - h * 0.12 - (h * band - spanY) / 2;
  return [cx - w / 2, y, w, h];
}

/** Screen-constant pins: one pin unit is this share of the view's width. */
const PIN_SHARE = 1 / 34;

/**
 * The onboarding's live map: the world, then the home city and the destination as they are picked, the flight
 * drawn between them and the view easing in on the trip (GSAP). Decorative: the summary next to it says it all.
 */
export function TripVisual({
  land,
  home,
  destination,
}: {
  land: string;
  home: Point | null;
  destination: Point | null;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const plane = useRef<SVGGElement>(null);
  const route = useRef<SVGPathElement>(null);
  const view = useRef<Box | null>(null);
  // The panel's shape (coarse): the trip is reframed when it changes, e.g. when the phone band first shows.
  const [shape, setShape] = useState('');
  useEffect(() => {
    const element = svg.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (box) setShape(`${Math.round(box.width / 40)}x${Math.round(box.height / 40)}`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const from = home ? projectWorld(home.longitude, home.latitude) : null;
  const to = destination ? projectWorld(destination.longitude, destination.latitude) : null;
  const path = from && to ? arc(from, to) : null;

  // The view eases to the trip; the newest pin drops in; the arc draws itself and a plane flies it.
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const points: XY[] = [from, to].filter((p): p is XY => p !== null);
    if (from && to)
      points.push({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - bow(from, to) / 2 });
    const rect = element.getBoundingClientRect();
    // What sits on the lower part of the map (the summary card, Pip on a phone): the trip stays above it.
    const clear = Array.from(element.parentElement?.querySelectorAll('[data-covers-map]') ?? [])
      .map((cover) => cover.getBoundingClientRect())
      .filter((cover) => cover.height > 40 && cover.top > rect.top + rect.height * 0.4)
      .reduce((lowest, cover) => Math.min(lowest, (cover.top - rect.top) / rect.height), 1);
    if (rect.height === 0) return; // hidden: framed once it shows
    const target = frame(points, rect.width / rect.height, clear);
    const show = (box: Box) => {
      view.current = box;
      element.setAttribute('viewBox', box.map((n) => n.toFixed(2)).join(' '));
      element.style.setProperty('--pin', (box[2] * PIN_SHARE).toFixed(3));
    };
    const start = view.current ?? frame([], rect.width / rect.height, 1);
    if (!motionAllowed()) {
      show(target);
      return;
    }
    show(start);
    let cancelled = false;
    const tweens: { kill: () => void }[] = [];
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      const box = { x: start[0], y: start[1], w: start[2], h: start[3] };
      tweens.push(
        gsap.to(box, {
          x: target[0],
          y: target[1],
          w: target[2],
          h: target[3],
          duration: 1.4,
          ease: 'power3.inOut',
          onUpdate: () => show([box.x, box.y, box.w, box.h]),
        }),
      );
      const line = route.current;
      if (line) {
        const length = line.getTotalLength();
        tweens.push(
          gsap.fromTo(
            line,
            { strokeDasharray: length, strokeDashoffset: length },
            { strokeDashoffset: 0, duration: 1.2, delay: 0.6, ease: 'power2.inOut' },
          ),
        );
        const dot = plane.current;
        if (dot) {
          const progress = { at: 0 };
          tweens.push(
            gsap.to(progress, {
              at: 1,
              duration: 3.2,
              delay: 1.8,
              ease: 'power1.inOut',
              repeat: -1,
              repeatDelay: 0.6,
              onUpdate: () => {
                const p = line.getPointAtLength(progress.at * length);
                dot.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
              },
            }),
          );
        }
      }
      element.querySelectorAll('[data-fresh]').forEach((pin) => {
        tweens.push(
          gsap.fromTo(
            pin,
            { y: -target[2] * PIN_SHARE * 3, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, delay: 0.9, ease: 'bounce.out' },
          ),
        );
      });
    });
    return () => {
      cancelled = true;
      tweens.forEach((tween) => tween.kill());
    };
    // Re-run when the trip's places change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home?.latitude, home?.longitude, destination?.latitude, destination?.longitude, shape]);

  return (
    <svg
      ref={svg}
      className={styles.tripMap}
      viewBox={`0 0 ${WORLD.width} ${WORLD_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path d={land} className={styles.tripLand} />
      {path ? (
        <>
          <path d={path} className={styles.tripArcShadow} />
          <path ref={route} d={path} className={styles.tripArc} />
          <g ref={plane} transform="translate(-999 -999)">
            <g className={styles.tripPin}>
              <circle r="0.45" className={styles.tripPlane} />
            </g>
          </g>
        </>
      ) : null}
      {from ? (
        <g key={`home-${from.x}-${from.y}`} data-fresh>
          <g transform={`translate(${from.x} ${from.y})`}>
            <g className={styles.tripPin}>
              <circle r="1" className={styles.tripHome} />
              <circle r="0.38" className={styles.tripHomeDot} />
            </g>
          </g>
        </g>
      ) : null}
      {to ? (
        <g key={`dest-${to.x}-${to.y}`} data-fresh>
          <g transform={`translate(${to.x} ${to.y})`}>
            <g className={styles.tripPin}>
              <circle r="1.9" className={styles.tripPulse} />
              <circle r="1" className={styles.tripDest} />
            </g>
          </g>
        </g>
      ) : null}
    </svg>
  );
}
