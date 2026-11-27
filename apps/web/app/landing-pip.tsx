'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LazyPipAvatar as PipAvatar } from './app/_components/lazy-pip-avatar';
import type { PipPose } from './app/_components/pip-pose';
import styles from './landing.module.css';

/** What the Pip demo tells the landing's Pip: a change was approved or dismissed. */
export type PipReaction = 'celebrate' | 'unsure';
const EVENT = 'globetrot:pip';

export function pipReact(reaction: PipReaction) {
  window.dispatchEvent(new CustomEvent<PipReaction>(EVENT, { detail: reaction }));
}

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

const LINES = ['pipHi1', 'pipHi2', 'pipHi3'] as const;

/**
 * The landing's Pip, alive: it looks where the pointer goes, smiles when you come close, jumps and says hello
 * when you click it, and reacts to the demo next to it (celebrates an approval, doubts a dismissal).
 */
export function LandingPip() {
  const t = useTranslations('landing');
  const body = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);
  const [pose, setPose] = useState<PipPose>('idle');
  const [line, setLine] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const said = useRef(0);

  const hop = async (height: number) => {
    const element = body.current;
    if (!element || !motionAllowed()) return;
    const { gsap } = await import('gsap');
    gsap
      .timeline()
      .to(element, { y: -height, rotate: -6, duration: 0.22, ease: 'power2.out' })
      .to(element, { y: 0, rotate: 0, duration: 0.6, ease: 'bounce.out' });
  };

  const showFor = (next: PipPose, ms: number) => {
    setPose(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPose('idle');
      setLine(null);
    }, ms);
  };

  useEffect(() => {
    const onReaction = (event: Event) => {
      const reaction = (event as CustomEvent<PipReaction>).detail;
      showFor(reaction, 1800);
      if (reaction === 'celebrate') void hop(26);
    };
    window.addEventListener(EVENT, onReaction);
    return () => {
      window.removeEventListener(EVENT, onReaction);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className={styles.pipStage}>
      <button
        ref={body}
        type="button"
        className={styles.pipBody}
        aria-label={t('pipPoke')}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onClick={() => {
          setLine(said.current % LINES.length);
          said.current += 1;
          showFor('celebrate', 2200);
          void hop(34);
        }}
      >
        <PipAvatar
          size={180}
          bare
          pose={pose}
          mood={hover || pose === 'celebrate' ? 'happy' : pose === 'unsure' ? 'thinking' : 'idle'}
          followPointer
        />
      </button>
      <p className={styles.pipBubble} data-on={line !== null || undefined} role="status">
        {line !== null ? t(LINES[line]!) : ''}
      </p>
    </div>
  );
}
