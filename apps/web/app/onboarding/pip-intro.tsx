'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { PipAvatar } from '../app/_components/pip-avatar';
import styles from './onboarding.module.css';

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Meet Pip before deciding: Pip walks in, says who it is and how it works, and shows one example suggestion for
 * the person's own destination (Approve or Dismiss work, on this screen only). Then the choice.
 */
export function PipIntro({
  destination,
  value,
  onChange,
}: {
  destination: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useTranslations('onboarding');
  const stage = useRef<HTMLDivElement>(null);
  const [example, setExample] = useState<'pending' | 'approved' | 'dismissed'>('pending');

  useEffect(() => {
    const element = stage.current;
    if (!element || !motionAllowed()) return;
    let cancelled = false;
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      gsap
        .timeline()
        .from(element.querySelector('[data-pip]'), {
          x: -140,
          rotate: -25,
          opacity: 0,
          duration: 0.8,
          ease: 'back.out(1.6)',
        })
        .from(element.querySelectorAll('[data-say]'), {
          opacity: 0,
          y: 10,
          scale: 0.92,
          duration: 0.4,
          ease: 'back.out(2)',
          stagger: 0.45,
        })
        .from(
          element.querySelector('[data-example]'),
          { opacity: 0, y: 16, duration: 0.45 },
          '+=0.1',
        )
        .from(
          element.querySelectorAll('[data-choice]'),
          { opacity: 0, y: 14, duration: 0.4, stagger: 0.12 },
          '+=0.05',
        );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.pipIntro} ref={stage}>
      <div className={styles.pipMeet}>
        <span data-pip className={styles.pipMeetAvatar}>
          <PipAvatar size={96} mood={example === 'approved' ? 'happy' : 'idle'} followPointer />
        </span>
        <div className={styles.pipSays}>
          <p data-say>{t('pipHello')}</p>
          <p data-say>{t('pipHow')}</p>
        </div>
      </div>

      <div className={styles.pipExample} data-example data-state={example}>
        <span className={styles.pipExampleKicker}>{t('pipExampleKicker')}</span>
        <strong>{t('pipExample', { place: destination })}</strong>
        <span>{t('pipExampleWhy')}</span>
        {example === 'pending' ? (
          <span className={styles.pipExampleActions}>
            <button type="button" onClick={() => setExample('approved')}>
              {t('pipApprove')}
            </button>
            <button type="button" onClick={() => setExample('dismissed')}>
              {t('pipDismiss')}
            </button>
          </span>
        ) : (
          <span className={styles.pipExampleDone} role="status">
            {example === 'approved' ? t('pipApproved') : t('pipDismissed')}
          </span>
        )}
      </div>

      <fieldset className={styles.pipChoices}>
        <legend className="sr-only">{t('pipTitle')}</legend>
        {([true, false] as const).map((on) => (
          <button
            key={String(on)}
            type="button"
            data-choice
            aria-pressed={value === on}
            onClick={() => onChange(on)}
          >
            <PipAvatar size={56} still mood={on ? 'happy' : 'idle'} />
            <span>
              <strong>{on ? t('pipYes') : t('pipNo')}</strong>
              <span>{on ? t('pipYesBody') : t('pipNoBody')}</span>
            </span>
          </button>
        ))}
      </fieldset>
    </div>
  );
}
