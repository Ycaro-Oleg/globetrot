'use client';

import { useEffect, useState } from 'react';
import styles from './landing.module.css';
import { TrackedLink } from './tracked-link';

/**
 * On a phone, once the hero has scrolled away, a slim bar keeps "Start planning" one thumb away. It steps aside
 * again at the closing call to action so two buttons never say the same thing on one screen.
 */
export function StickyCta({ label, note }: { label: string; note: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('top');
    const close = document.getElementById('start');
    if (!hero || !close || typeof IntersectionObserver === 'undefined') return;
    const seen = { hero: true, close: false };
    const update = () => setShown(!seen.hero && !seen.close);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) seen.hero = entry.isIntersecting;
        if (entry.target === close) seen.close = entry.isIntersecting;
      }
      update();
    });
    observer.observe(hero);
    observer.observe(close);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={styles.sticky} data-shown={shown || undefined} aria-hidden={!shown}>
      <span>{note}</span>
      <TrackedLink
        href="/signup"
        className={styles.cta}
        tabIndex={shown ? 0 : -1}
        event="cta_click"
      >
        {label} <span aria-hidden="true">→</span>
      </TrackedLink>
    </div>
  );
}
