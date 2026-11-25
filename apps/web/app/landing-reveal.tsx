'use client';

import { useEffect } from 'react';

/**
 * Below the fold, sections rise in gently the first time they scroll into view. Only with scripts and motion on:
 * without them everything is simply there. The hero is never animated (it is the largest paint).
 */
export function LandingReveal() {
  useEffect(() => {
    if (
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          ScrollTrigger.batch('[data-reveal]', {
            start: 'top 88%',
            once: true,
            onEnter: (elements) =>
              gsap.fromTo(
                elements,
                { opacity: 0, y: 28 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.7,
                  ease: 'power3.out',
                  stagger: 0.09,
                  clearProps: 'transform',
                },
              ),
          });
        });
        revert = () => context.revert();
      },
    );
    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);
  return null;
}
