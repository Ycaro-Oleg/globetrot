'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemoCity, DemoCityKey, DemoMap } from '../lib/demo-map';
import styles from './landing-demo-map.module.css';

const MAX_STOPS = 7;
const MAX_NIGHTS = 14;
const START: readonly Stop[] = [
  { key: 'lisbon', nights: 3 },
  { key: 'madrid', nights: 2 },
  { key: 'barcelona', nights: 3 },
  { key: 'paris', nights: 3 },
];

interface Stop {
  readonly key: DemoCityKey;
  readonly nights: number;
}

/** An airmail arc: bowed sideways from the straight line (up, or left when the leg runs north–south). */
function arcPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  let nx = -dy / length;
  let ny = dx / length;
  if (ny > 0 || (Math.abs(ny) < 0.2 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const bow = Math.max(18, length * 0.16);
  const cx = (a.x + b.x) / 2 + nx * bow;
  const cy = (a.y + b.y) / 2 + ny * bow;
  return `M${a.x} ${a.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`;
}

/** Great-circle distance in kilometres ("as the crow flies"), as the board shows it. */
function km(a: DemoCity, b: DemoCity) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A live, simplified map board on the landing: tap a city to add it, pick a stop to change its nights, reorder or
 * remove it, and watch the route redraw. Nothing is saved; it only shows how planning on the map feels.
 */
export function DemoMapBoard({ map }: { map: DemoMap }) {
  const t = useTranslations('landing.demo');
  const cityName = (key: DemoCityKey) => t(`cities.${key}`);
  const byKey = useMemo(() => new Map(map.cities.map((city) => [city.key, city])), [map]);
  const [route, setRoute] = useState<readonly Stop[]>(START);
  const [selected, setSelected] = useState<number | null>(null);
  const [fresh, setFresh] = useState<DemoCityKey | null>(null);
  const [announce, setAnnounce] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const comet = useRef<SVGCircleElement>(null);
  const trail = useRef<SVGPathElement>(null);

  const points = route.map((stop) => byKey.get(stop.key)!);
  const nights = route.reduce((sum, stop) => sum + stop.nights, 0);
  const inRoute = new Set(route.map((stop) => stop.key));
  const trailPath = points
    .slice(1)
    .map((point, index) => arcPath(points[index]!, point))
    .join(' ');

  const add = (key: DemoCityKey) => {
    if (route.length >= MAX_STOPS) return setAnnounce(t('full'));
    setRoute((current) => [...current, { key, nights: 2 }]);
    setSelected(route.length);
    setFresh(key);
    setAnnounce(t('added', { city: cityName(key) }));
  };
  const change = (index: number, delta: number) =>
    setRoute((current) =>
      current.map((stop, i) =>
        i === index
          ? { ...stop, nights: Math.max(0, Math.min(MAX_NIGHTS, stop.nights + delta)) }
          : stop,
      ),
    );
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= route.length) return;
    setRoute((current) => {
      const next = [...current];
      const [stop] = next.splice(index, 1);
      next.splice(to, 0, stop!);
      return next;
    });
    setSelected(to);
  };
  const remove = (index: number) => {
    if (route.length <= 1) return;
    setAnnounce(t('removed', { city: cityName(route[index]!.key) }));
    setRoute((current) => current.filter((_, i) => i !== index));
    setSelected(null);
  };

  // First sight: the route draws itself and the pins drop in, once, when the board scrolls into view.
  useEffect(() => {
    const element = root.current;
    if (!element || !motionAllowed()) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const { gsap } = await import('gsap');
        if (cancelled) return;
        const arcs = element.querySelectorAll<SVGPathElement>('[data-arc]');
        arcs.forEach((arc) => {
          const length = arc.getTotalLength();
          gsap.fromTo(
            arc,
            { strokeDasharray: length, strokeDashoffset: length },
            {
              strokeDashoffset: 0,
              duration: 0.7,
              ease: 'power2.inOut',
              delay: 0.25 + Number(arc.dataset.arc) * 0.28,
              onComplete: () => {
                gsap.set(arc, { clearProps: 'strokeDasharray,strokeDashoffset' });
              },
            },
          );
        });
        gsap.from(element.querySelectorAll('[data-pin]'), {
          y: -26,
          opacity: 0,
          duration: 0.7,
          ease: 'bounce.out',
          stagger: 0.28,
        });
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  // A stop just added drops in and its leg draws itself.
  useEffect(() => {
    const element = root.current;
    if (!fresh || !element || !motionAllowed()) return;
    let cancelled = false;
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      const pin = element.querySelector(`[data-pin="${fresh}"]`);
      if (pin)
        gsap.from(pin, { y: -30, scale: 0.4, opacity: 0, duration: 0.75, ease: 'bounce.out' });
      const arcs = element.querySelectorAll<SVGPathElement>('[data-arc]');
      const last = arcs[arcs.length - 1];
      if (last) {
        const length = last.getTotalLength();
        gsap.fromTo(
          last,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(last, { clearProps: 'strokeDasharray,strokeDashoffset' });
            },
          },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fresh]);

  // The comet travels the whole route, like the board's airmail line.
  useEffect(() => {
    const path = trail.current;
    const dot = comet.current;
    if (!path || !dot || !motionAllowed() || route.length < 2) return;
    let tween: { kill: () => void } | null = null;
    let cancelled = false;
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      const length = path.getTotalLength();
      const progress = { at: 0 };
      tween = gsap.to(progress, {
        at: 1,
        duration: Math.max(3, route.length * 1.2),
        ease: 'none',
        repeat: -1,
        onUpdate: () => {
          const point = path.getPointAtLength(progress.at * length);
          dot.setAttribute('cx', point.x.toFixed(1));
          dot.setAttribute('cy', point.y.toFixed(1));
        },
      });
    });
    return () => {
      cancelled = true;
      tween?.kill();
    };
  }, [trailPath, route.length]);

  return (
    <div className={styles.board} ref={root}>
      <div
        className={styles.map}
        role="group"
        aria-label={t('map')}
        style={{ aspectRatio: `${map.width} / ${map.height}` }}
      >
        <svg viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden="true">
          <rect width={map.width} height={map.height} className={styles.sea} />
          {map.countries.map((country) => (
            <path
              key={country.iso}
              d={country.d}
              className={styles.land}
              data-on={route.some((stop) => country.iso === ISO[stop.key]) || undefined}
            />
          ))}
          {points.slice(1).map((point, index) => (
            <path
              key={`${route[index]!.key}-${route[index + 1]!.key}`}
              d={arcPath(points[index]!, point)}
              className={styles.arc}
              data-arc={index}
            />
          ))}
          <path ref={trail} d={trailPath || 'M0 0'} className={styles.trail} />
          {route.length > 1 ? (
            <circle ref={comet} r="7" className={styles.comet} cx="-20" cy="-20" />
          ) : null}
        </svg>

        {map.cities
          .filter((city) => !inRoute.has(city.key))
          .map((city) => (
            <button
              key={city.key}
              type="button"
              className={styles.city}
              style={{ left: `${city.left}%`, top: `${city.top}%` }}
              onClick={() => add(city.key)}
              aria-label={t('add', { city: cityName(city.key) })}
            >
              <span className={styles.cityDot} aria-hidden="true" />
              <span className={styles.cityName}>{cityName(city.key)}</span>
            </button>
          ))}

        {route.map((stop, index) => {
          const city = byKey.get(stop.key)!;
          return (
            <button
              key={stop.key}
              type="button"
              data-pin={stop.key}
              className={styles.pin}
              data-selected={selected === index || undefined}
              style={{ left: `${city.left}%`, top: `${city.top}%` }}
              onClick={() => setSelected(selected === index ? null : index)}
              aria-pressed={selected === index}
            >
              <span className={styles.pinHead}>{index + 1}</span>
              <span className={styles.pinName}>{cityName(stop.key)}</span>
              <span className="sr-only">, {t('nights', { count: stop.nights })}</span>
            </button>
          );
        })}
        <p className={styles.hint} aria-hidden="true">
          {t('hint')}
        </p>
      </div>

      <div className={styles.panel}>
        <span className={styles.kicker}>{t('route')}</span>
        <strong className={styles.title}>{t('title')}</strong>
        <span className={styles.summary}>{t('summary', { stops: route.length, nights })}</span>
        <ol className={styles.stops}>
          {route.map((stop, index) => {
            const city = byKey.get(stop.key)!;
            const next = route[index + 1] ? byKey.get(route[index + 1]!.key) : undefined;
            const open = selected === index;
            return (
              <li key={stop.key} className={styles.row} data-open={open || undefined}>
                <div className={styles.rowHead}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => setSelected(open ? null : index)}
                    aria-expanded={open}
                  >
                    <span className={styles.number} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>
                      <strong>{cityName(stop.key)}</strong>
                      <small>{t('nights', { count: stop.nights })}</small>
                    </span>
                  </button>
                  <span className={styles.order}>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={t('up', { city: cityName(stop.key) })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === route.length - 1}
                      aria-label={t('down', { city: cityName(stop.key) })}
                    >
                      ↓
                    </button>
                  </span>
                </div>
                {open ? (
                  <div className={styles.controls}>
                    <button
                      type="button"
                      onClick={() => change(index, -1)}
                      disabled={stop.nights === 0}
                      aria-label={t('fewer', { city: cityName(stop.key) })}
                    >
                      −
                    </button>
                    <span aria-live="polite">{t('nights', { count: stop.nights })}</span>
                    <button
                      type="button"
                      onClick={() => change(index, 1)}
                      disabled={stop.nights === MAX_NIGHTS}
                      aria-label={t('more', { city: cityName(stop.key) })}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => remove(index)}
                      disabled={route.length <= 1}
                    >
                      {t('remove')}
                    </button>
                  </div>
                ) : null}
                {next ? (
                  <small className={styles.leg}>{t('leg', { km: km(city, next) })}</small>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className={styles.foot}>
          <Link href="/signup" className={styles.cta}>
            {t('cta')} <span aria-hidden="true">→</span>
          </Link>
          <small>{t('note')}</small>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
      </div>
    </div>
  );
}

/** The country each demo city is in, to tint the countries on the route. */
const ISO: Record<DemoCityKey, string> = {
  lisbon: 'PT',
  porto: 'PT',
  seville: 'ES',
  madrid: 'ES',
  barcelona: 'ES',
  nice: 'FR',
  milan: 'IT',
  rome: 'IT',
  paris: 'FR',
  london: 'GB',
  amsterdam: 'NL',
  berlin: 'DE',
  prague: 'CZ',
};
