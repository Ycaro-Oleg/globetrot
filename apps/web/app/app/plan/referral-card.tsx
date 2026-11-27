'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import styles from './plan.module.css';

/** The person's referral link to copy (ADR-0029): a friend's first payment earns them a free trip pass. */
export function ReferralCard({
  referral,
}: {
  referral: { code: string; joined: number; passCredits: number };
}) {
  const t = useTranslations('referral');
  const id = useId();
  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    // Only the browser knows the address it is on.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);
  const link = origin ? `${origin}/?ref=${referral.code}` : '';

  return (
    <section className={styles.fact} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('title')}</h2>
      <p>{t('body')}</p>
      <div className={styles.linkRow}>
        <input
          readOnly
          value={link}
          aria-label={t('linkLabel')}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className={styles.secondary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setStatus(t('copied'));
            } catch {
              setStatus(t('copyFailed'));
            }
          }}
        >
          {t('copy')}
        </button>
      </div>
      <p className={styles.small}>
        {t('counts', { joined: referral.joined, credits: referral.passCredits })}
      </p>
      <p className={styles.small} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
