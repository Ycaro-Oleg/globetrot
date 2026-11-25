'use client';

import { useEffect } from 'react';

/**
 * The landing's scroll story (GSAP ScrollTrigger), on top of the plain page: everything below works and reads the
 * same without scripts or with reduced motion, where none of this runs.
 *
 * - `[data-zoom-reveal]`: the demo map lies tilted back and a little small, and stands up to full size as it scrolls
 *   into view, like a map unfolded on a table being lifted to the eye.
 * - `[data-step-path]`: a flight from step 1 to step 3: the route draws itself behind a plane as the section scrolls,
 *   each step's pin drops when the plane reaches it, and the step's card rises.
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

        // The map stands up: tilted back and small, then flat and full size.
        media.add({ wide: '(min-width: 860px)', narrow: '(max-width: 859px)' }, (context) => {
          const wide = Boolean(context.conditions?.wide);
          document.querySelectorAll<HTMLElement>('[data-zoom-reveal]').forEach((frame) => {
            gsap.fromTo(
              frame,
              {
                rotateX: wide ? 38 : 24,
                scale: wide ? 0.82 : 0.9,
                y: wide ? 60 : 30,
                transformPerspective: 1400,
                transformOrigin: '50% 100%',
                boxShadow: '0 0 0 rgb(15 23 42 / 0)',
              },
              {
                rotateX: 0,
                scale: 1,
                y: 0,
                boxShadow: '0 40px 80px -40px rgb(15 23 42 / 0.45)',
                ease: 'power1.out',
                scrollTrigger: {
                  trigger: frame,
                  start: 'top 95%',
                  end: wide ? 'center 55%' : 'top 35%',
                  scrub: 0.7,
                },
              },
            );
          });
        });

        const context = gsap.context(() => {
          // The flight through the three steps: route, plane, pins and cards, all on the scroll.
          document.querySelectorAll<HTMLElement>('[data-step-path]').forEach((section) => {
            const route = section.querySelector<SVGPathElement>('[data-route]');
            const draw = section.querySelector<SVGPathElement>('[data-route-draw]');
            const plane = section.querySelector<SVGGElement>('[data-plane]');
            const pins = section.querySelectorAll<SVGGElement>('[data-pin]');
            const steps = section.querySelectorAll<HTMLElement>('[data-path-step]');
            if (!route || !draw || !plane) return;
            const length = route.getTotalLength();
            const flight = { at: 0 };
            const fly = () => {
              const at = flight.at * length;
              const p = route.getPointAtLength(at);
              const q = route.getPointAtLength(Math.min(length, at + 1));
              const r = route.getPointAtLength(Math.max(0, at - 1));
              const angle = (Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI;
              plane.setAttribute(
                'transform',
                `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
              );
              // Landing: the plane fades into the last pin instead of covering it.
              plane.style.opacity = String(Math.min(1, (1 - flight.at) / 0.04));
            };
            fly();
            const timeline = gsap.timeline({
              scrollTrigger: { trigger: section, start: 'top 70%', end: 'center 40%', scrub: 0.8 },
            });
            timeline
              .fromTo(
                draw,
                { strokeDashoffset: 1 },
                { strokeDashoffset: 0, ease: 'none', duration: 1 },
                0,
              )
              .fromTo(flight, { at: 0 }, { at: 1, ease: 'none', duration: 1, onUpdate: fly }, 0);
            pins.forEach((pin, index) => {
              const at = pins.length > 1 ? index / (pins.length - 1) : 0;
              // Drawn by hand around the pin's tip: GSAP's own origin handling drifts on SVG groups.
              const [tx, ty] = (pin.dataset.tip ?? '0 0').split(' ').map(Number) as [
                number,
                number,
              ];
              const drop = { scale: 0, y: -24 };
              const place = () =>
                pin.setAttribute(
                  'transform',
                  `translate(${tx} ${ty + drop.y}) scale(${drop.scale}) translate(${-tx} ${-ty})`,
                );
              place();
              timeline.to(
                drop,
                { scale: 1, y: 0, duration: 0.12, ease: 'back.out(3)', onUpdate: place },
                Math.max(0, at - 0.04),
              );
            });
            steps.forEach((step, index) => {
              const at = steps.length > 1 ? index / (steps.length - 1) : 0;
              timeline.fromTo(
                step,
                // Movement only: the text keeps its full contrast the whole time.
                { y: 56, scale: 0.94 },
                { y: 0, scale: 1, duration: 0.18, ease: 'power2.out' },
                Math.max(0, at - 0.1),
              );
            });
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
