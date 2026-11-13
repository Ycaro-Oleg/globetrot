'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { PipAvatar } from '../_components/pip-avatar';
import styles from './world-map.module.css';

export type StampedVisa = { countryCode: string; city: string; stampedAt: string };

/**
 * The celebration when marking a stop visited stamps a commemorative visa: the stamp drops in, Pip waves.
 * A modal dialog: focus moves to "Continue", Esc closes it (handled by the board).
 */
export function VisaOverlay({ visa, onClose }: { visa: StampedVisa; onClose: () => void }) {
  const t = useTranslations('mapBoard.visa');
  const locale = useLocale();
  const stamp = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const country = (() => {
    try {
      return (
        new Intl.DisplayNames([locale], { type: 'region' }).of(visa.countryCode) ?? visa.countryCode
      );
    } catch {
      return visa.countryCode;
    }
  })();
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(visa.stampedAt))
    .replace(/\./g, '')
    .toUpperCase();

  useEffect(() => {
    continueRef.current?.focus();
    const reduced =
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !stamp.current?.animate) return;
    stamp.current.animate(
      [
        { transform: 'rotate(-30deg) scale(2.4)', opacity: 0 },
        { transform: 'rotate(-6deg) scale(.92)', opacity: 1, offset: 0.55 },
        { transform: 'rotate(-9deg) scale(1.04)', offset: 0.75 },
        { transform: 'rotate(-8deg) scale(1)' },
      ],
      { duration: 700, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'both' },
    );
  }, []);

  return (
    <div className={styles.visaBackdrop}>
      <div
        className={styles.visaDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visa-title"
        aria-describedby="visa-body"
      >
        <span className={styles.visaKicker}>
          {t('kicker')} · {visa.countryCode}
        </span>
        <div ref={stamp} className={styles.visaStamp} aria-hidden="true">
          <span>{t('entry')}</span>
          <strong>{country}</strong>
          <span>{date}</span>
        </div>
        <PipAvatar size={112} mood="happy" />
        <h2 id="visa-title">{t('title')}</h2>
        <p id="visa-body">
          {t('body', { country, city: visa.city })} <small>{t('disclaimer')}</small>
        </p>
        <div className={styles.visaActions}>
          <button ref={continueRef} type="button" className={styles.visaContinue} onClick={onClose}>
            {t('continue')}
          </button>
          <Link href="/app/passport" className={styles.visaSee}>
            {t('see')}
          </Link>
        </div>
      </div>
    </div>
  );
}
