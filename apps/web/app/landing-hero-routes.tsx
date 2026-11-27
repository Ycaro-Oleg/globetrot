'use client';

import { useEffect, useRef } from 'react';
import styles from './landing.module.css';

/** Cities on the halftone world (its own 1322×654 drawing), for the hero's flights. */
const AT = {
  fortaleza: [440, 318],
  saoPaulo: [405, 352],
  newYork: [332, 160],
  lisbon: [575, 160],
  paris: [610, 122],
  tokyo: [1072, 166],
} as const;
export type HeroCity = keyof typeof AT;
/** Where each name sits next to its dot, so neighbours (Lisbon and Paris, Fortaleza and São Paulo) never touch. */
const LABEL: Record<HeroCity, [dx: number, dy: number, anchor: 'start' | 'middle' | 'end']> = {
  fortaleza: [14, 5, 'start'],
  saoPaulo: [-14, 14, 'end'],
  newYork: [0, -16, 'middle'],
  lisbon: [-14, 6, 'end'],
  paris: [0, -16, 'middle'],
  tokyo: [0, -16, 'middle'],
};

const FLIGHTS: [HeroCity, HeroCity][] = [
  ['fortaleza', 'lisbon'],
  ['newYork', 'paris'],
  ['saoPaulo', 'tokyo'],
  ['lisbon', 'newYork'],
  ['paris', 'tokyo'],
];
/** Seconds between one take-off and the next: two or three flights are in the air at once. */
const EVERY = 1.6;

const arc = ([ax, ay]: readonly number[], [bx, by]: readonly number[]) =>
  `M${ax} ${ay} Q${(ax! + bx!) / 2} ${Math.min(ay!, by!) - Math.hypot(bx! - ax!, by! - ay!) * 0.3} ${bx} ${by}`;

/**
 * Decorative flights over the hero's halftone world: the cities glow with their names, and planes keep taking off
 * (two or three in the air at once), each drawing its route, landing with a ripple and leaving a fading trail.
 * Loads after the page and never touches the headline (the largest paint). Hidden from assistive technology.
 */
export function HeroRoutes({ labels }: { labels: Record<HeroCity, string> }) {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = svg.current;
    if (
      !element ||
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    let timeline: { kill: () => void } | null = null;
    let cancelled = false;
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      const tl = gsap.timeline({ repeat: -1, delay: 0.8 });
      element.querySelectorAll<SVGGElement>('[data-flight]').forEach((flight, index) => {
        const line = flight.querySelector<SVGPathElement>('[data-line]')!;
        const plane = flight.querySelector<SVGGElement>('[data-plane]')!;
        const ripple = flight.querySelector('[data-ripple]')!;
        const length = line.getTotalLength();
        const progress = { at: 0 };
        const fly = () => {
          const at = progress.at * length;
          const p = line.getPointAtLength(at);
          const q = line.getPointAtLength(Math.min(length, at + 2));
          const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          plane.setAttribute(
            'transform',
            `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
          );
        };
        const start = index * EVERY;
        tl.set(flight, { opacity: 1 }, start)
          .fromTo(
            line,
            { strokeDasharray: length, strokeDashoffset: length, opacity: 1 },
            { strokeDashoffset: 0, duration: 2.2, ease: 'power1.inOut' },
            start,
          )
          .fromTo(plane, { opacity: 0 }, { opacity: 1, duration: 0.3 }, start)
          .fromTo(
            progress,
            { at: 0 },
            { at: 1, duration: 2.2, ease: 'power1.inOut', onUpdate: fly },
            start,
          )
          .to(plane, { opacity: 0, duration: 0.25 }, start + 2.1)
          .fromTo(
            ripple,
            { scale: 0.2, opacity: 0.9 },
            {
              scale: 2.6,
              opacity: 0,
              duration: 1.1,
              ease: 'power2.out',
              transformOrigin: 'center',
            },
            start + 2.15,
          )
          .to(line, { opacity: 0, duration: 1.2 }, start + 3.2);
      });
      timeline = tl;
    });
    return () => {
      cancelled = true;
      timeline?.kill();
    };
  }, []);

  return (
    <svg ref={svg} className={styles.heroRoutes} viewBox="0 0 1322 654" aria-hidden="true">
      {FLIGHTS.map(([from, to]) => (
        <g key={`${from}-${to}`} data-flight opacity="0">
          <path data-line d={arc(AT[from], AT[to])} className={styles.heroRoute} />
          <circle data-ripple cx={AT[to][0]} cy={AT[to][1]} r="9" className={styles.heroRouteEnd} />
          <g data-plane opacity="0">
            <path
              d="M11 0 L-5 -2.6 L-9 -10 L-12 -10 L-9 -2 L-14 -1.4 L-16 -5 L-18 -5 L-16.5 0 L-18 5 L-16 5 L-14 1.4 L-9 2 L-12 10 L-9 10 L-5 2.6 Z"
              className={styles.heroPlane}
            />
          </g>
        </g>
      ))}
      {(Object.keys(AT) as HeroCity[]).map((city) => (
        <g key={city} className={styles.heroCity}>
          <circle cx={AT[city][0]} cy={AT[city][1]} r="11" className={styles.heroCityGlow} />
          <circle cx={AT[city][0]} cy={AT[city][1]} r="4.5" className={styles.heroCityDot} />
          <text
            x={AT[city][0] + LABEL[city][0]}
            y={AT[city][1] + LABEL[city][1]}
            textAnchor={LABEL[city][2]}
            className={styles.heroCityName}
          >
            {labels[city]}
          </text>
        </g>
      ))}
    </svg>
  );
}
