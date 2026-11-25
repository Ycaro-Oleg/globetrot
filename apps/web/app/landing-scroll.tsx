'use client';

import { useEffect } from 'react';

/**
 * The landing's scroll story (GSAP ScrollTrigger), on top of the plain page: everything below works and reads the
 * same without scripts or with reduced motion, where none of this runs.
 *
 * - `[data-zoom-reveal]`: the demo map opens from a small pill to the full frame as its section scrolls through
 *   (pinned on wide screens, so the opening is the whole scroll).
 * - `[data-step-path]`: the airmail line through "how it works" draws itself with the scroll; each step rises as
 *   the line reaches it, and a dash keeps travelling along it.
 * - `[data-words]`: a heading's words come into focus (blur to sharp) one after another as it scrolls up.
 * - `[data-marquee]`: rows of destinations slide with the scroll (only with it: nothing moves on its own) and lean
 *   into fast scrolling.
 */
export function LandingScroll() {
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
        const media = gsap.matchMedia();

        // Zoom reveal: pinned on wide screens, a shorter unpinned opening on phones.
        media.add({ wide: '(min-width: 860px)', narrow: '(max-width: 859px)' }, (context) => {
          const wide = Boolean(context.conditions?.wide);
          document.querySelectorAll<HTMLElement>('[data-zoom-reveal]').forEach((frame) => {
            gsap.fromTo(
              frame,
              { clipPath: 'inset(34% 36% 34% 36% round 999px)', scale: 0.94 },
              {
                clipPath: 'inset(0% 0% 0% 0% round 28px)',
                scale: 1,
                ease: 'none',
                scrollTrigger: wide
                  ? {
                      trigger: frame,
                      start: 'center center',
                      end: '+=70%',
                      scrub: 0.6,
                      pin: true,
                      // The section is a flex column, where GSAP would drop the spacing by default.
                      pinSpacing: true,
                      anticipatePin: 1,
                    }
                  : { trigger: frame, start: 'top 90%', end: 'top 30%', scrub: 0.6 },
              },
            );
          });
        });

        const context = gsap.context(() => {
          // Step path: the line draws with the scroll and the steps rise as it reaches them.
          document.querySelectorAll<HTMLElement>('[data-step-path]').forEach((section) => {
            const line = section.querySelector<SVGPathElement>('[data-path-line]');
            const dash = section.querySelector<SVGPathElement>('[data-path-dash]');
            const steps = section.querySelectorAll<HTMLElement>('[data-path-step]');
            if (!line) return;
            const timeline = gsap.timeline({
              scrollTrigger: { trigger: section, start: 'top 75%', end: 'bottom 70%', scrub: 0.8 },
            });
            timeline.fromTo(
              line,
              { strokeDashoffset: 1 },
              { strokeDashoffset: 0, ease: 'none', duration: 1 },
              0,
            );
            steps.forEach((step, index) => {
              timeline.fromTo(
                step,
                // Movement only: the text keeps its full contrast the whole time.
                { y: 56, scale: 0.94 },
                { y: 0, scale: 1, duration: 0.22, ease: 'power2.out' },
                (index / steps.length) * 0.85 + 0.05,
              );
            });
            if (dash)
              gsap.fromTo(
                dash,
                { strokeDashoffset: 0 },
                { strokeDashoffset: -1, duration: 4.5, ease: 'none', repeat: -1 },
              );
          });

          // Words come into focus one after another.
          document.querySelectorAll<HTMLElement>('[data-words]').forEach((heading) => {
            gsap.fromTo(
              heading.querySelectorAll('[data-word]'),
              // Focus only: the colour stays full, so the text never drops below its contrast.
              { filter: 'blur(6px)', y: 10 },
              {
                filter: 'blur(0px)',
                y: 0,
                stagger: 0.12,
                ease: 'power1.out',
                scrollTrigger: { trigger: heading, start: 'top 88%', end: 'top 45%', scrub: 0.5 },
              },
            );
          });

          // Destination rows slide with the scroll and lean into its speed.
          document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((band) => {
            const rows = band.querySelectorAll<HTMLElement>('[data-marquee-row]');
            const lean = gsap.quickTo(rows, 'skewX', { duration: 0.5, ease: 'power3.out' });
            rows.forEach((row, index) => {
              const left = index % 2 === 0;
              gsap.fromTo(
                row,
                { xPercent: left ? 0 : -30 },
                {
                  xPercent: left ? -30 : 0,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: band,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 0.4,
                    onUpdate: (self) => lean(gsap.utils.clamp(-8, 8, self.getVelocity() / -260)),
                  },
                },
              );
            });
          });
        });

        revert = () => {
          context.revert();
          media.revert();
        };
      },
    );
    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);
  return null;
}

/** A heading's text split into words for `[data-words]` (the text reads the same; the spans are only for motion). */
export function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, index) => (
        <span key={index}>
          <span data-word style={{ display: 'inline-block' }}>
            {word}
          </span>
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}
