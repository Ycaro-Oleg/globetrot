'use client';

import { useEffect } from 'react';

/**
 * The landing's own section links (How it works, Pip, Examples, Pricing) glide to their section instead of jumping
 * there in one frame. With reduced motion, or before the script loads, they are plain anchors. Focus moves to the
 * section either way, so keyboard and screen-reader users land where the eye does.
 */
export function LandingAnchors() {
  useEffect(() => {
    const reduced = () =>
      document.documentElement.dataset.motion === 'reduced' ||
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const arrive = (target: HTMLElement, id: string) => {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      window.history.pushState(null, '', `#${id}`);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!id || !target) return;
      event.preventDefault();
      if (reduced()) {
        target.scrollIntoView();
        arrive(target, id);
        return;
      }
      void Promise.all([import('gsap'), import('gsap/ScrollToPlugin')]).then(
        ([{ gsap }, { ScrollToPlugin }]) => {
          gsap.registerPlugin(ScrollToPlugin);
          gsap.to(window, {
            duration: 1.1,
            ease: 'power3.inOut',
            scrollTo: { y: target, offsetY: 16, autoKill: true },
            onComplete: () => arrive(target, id),
          });
        },
      );
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
