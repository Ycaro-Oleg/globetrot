'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import styles from './pip.module.css';

/**
 * The person's address for forwarding bookings (ADR-0032): a forwarded confirmation becomes a Pip proposal for
 * the latest trip, to review here like any other. Pip never books anything.
 */
export function ForwardCard({ address }: { address: string }) {
  const t = useTranslations('pipPage.forward');
  const id = useId();
  const [status, setStatus] = useState('');
  return (
    <section className={styles.forward} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('title')}</h2>
      <p>{t('body')}</p>
      <div className={styles.forwardRow}>
        <input
          readOnly
          value={address}
          aria-label={t('label')}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setStatus(t('copied'));
            } catch {
              setStatus(t('copyFailed'));
            }
          }}
        >
          {t('copy')}
        </button>
      </div>
      <p className={styles.forwardNote} role="status" aria-live="polite">
        {status || t('note')}
      </p>
    </section>
  );
}
