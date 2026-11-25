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
const FLIGHTS: [keyof typeof AT, keyof typeof AT][] = [
  ['fortaleza', 'lisbon'],
  ['newYork', 'paris'],
  ['saoPaulo', 'lisbon'],
  ['lisbon', 'tokyo'],
];

const arc = ([ax, ay]: readonly number[], [bx, by]: readonly number[]) =>
  `M${ax} ${ay} Q${(ax! + bx!) / 2} ${Math.min(ay!, by!) - Math.hypot(bx! - ax!, by! - ay!) * 0.3} ${bx} ${by}`;

/**
 * Decorative flights over the hero's halftone world: one at a time, each arc draws itself, a light flies it and
 * the destination pulses, then the next. Loads after the page and never touches the headline (the largest paint).
 */
export function HeroRoutes() {
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
      const tl = gsap.timeline({ repeat: -1, delay: 1.2 });
      element.querySelectorAll<SVGGElement>('[data-flight]').forEach((flight) => {
        const line = flight.querySelector('path')!;
        const dot = flight.querySelector<SVGCircleElement>('[data-dot]')!;
        const end = flight.querySelector('[data-end]')!;
        const length = line.getTotalLength();
        const progress = { at: 0 };
        tl.set(flight, { opacity: 1 })
          .fromTo(
            line,
            { strokeDasharray: length, strokeDashoffset: length },
            { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' },
          )
          .fromTo(
            progress,
            { at: 0 },
            {
              at: 1,
              duration: 1.4,
              ease: 'power1.inOut',
              onUpdate: () => {
                const p = line.getPointAtLength(progress.at * length);
                dot.setAttribute('cx', p.x.toFixed(1));
                dot.setAttribute('cy', p.y.toFixed(1));
              },
            },
            '<',
          )
          .fromTo(
            end,
            { scale: 0, opacity: 1 },
            { scale: 1, duration: 0.5, ease: 'back.out(3)', transformOrigin: 'center' },
          )
          .to(flight, { opacity: 0, duration: 0.6, delay: 0.9 });
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
          <circle cx={AT[from][0]} cy={AT[from][1]} r="5" className={styles.heroRouteStart} />
          <path d={arc(AT[from], AT[to])} className={styles.heroRoute} />
          <circle data-dot r="5" className={styles.heroRouteDot} cx="-20" cy="-20" />
          <circle data-end cx={AT[to][0]} cy={AT[to][1]} r="8" className={styles.heroRouteEnd} />
        </g>
      ))}
    </svg>
  );
}
