'use client';

import { useEffect, useRef } from 'react';
import { PipAvatar } from '../app/_components/pip-avatar';
import styles from './onboarding.module.css';

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Pip as the onboarding's guide, on the live map: one short line per step that reacts to what the person just
 * picked (the city, the destination, the nights, the answer). Each new line pops in and Pip hops. Flavour only:
 * the questions and the summary carry everything, so it is hidden from assistive tech.
 */
export function TripPip({ line, cheer }: { line: string; cheer: boolean }) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element || !motionAllowed()) return;
    let cancelled = false;
    const tweens: { kill: () => void }[] = [];
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      tweens.push(
        gsap.fromTo(
          element.querySelector('[data-bubble]'),
          { opacity: 0, scale: 0.7, y: 8 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.45,
            ease: 'back.out(2.2)',
            transformOrigin: '0% 100%',
          },
        ),
        gsap
          .timeline()
          .to(element.querySelector('[data-body]'), {
            y: cheer ? -26 : -12,
            rotate: -6,
            duration: 0.2,
            ease: 'power2.out',
          })
          .to(element.querySelector('[data-body]'), {
            y: 0,
            rotate: 0,
            duration: 0.6,
            ease: 'bounce.out',
          }),
      );
    });
    return () => {
      cancelled = true;
      tweens.forEach((tween) => tween.kill());
    };
  }, [line, cheer]);

  return (
    <div className={styles.tripPip} ref={stage} aria-hidden="true" data-covers-map>
      <span data-body className={styles.tripPipBody}>
        <PipAvatar
          size={84}
          bare
          pose={cheer ? 'celebrate' : 'idle'}
          mood={cheer ? 'happy' : 'idle'}
          followPointer
        />
      </span>
      <p data-bubble className={styles.tripPipBubble}>
        {line}
      </p>
    </div>
  );
}
