'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition } from 'react';
import { track } from '../../../../lib/analytics';
import { setTripShare, type ShareState } from '../../_components/trip-actions';
import styles from './trip-hub.module.css';

/**
 * Share a trip: one switch makes a private link anyone can open (route, month and answer; amounts only if
 * chosen), with copy, the phone's share sheet and a post on X. Turning it off kills the link for good.
 */
export function ShareCard({
  tripId,
  title,
  initial,
}: {
  tripId: string;
  title: string;
  initial: ShareState;
}) {
  const t = useTranslations('tripHub.share');
  const id = useId();
  const [share, setShare] = useState(initial);
  const [status, setStatus] = useState('');
  const [origin, setOrigin] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    // Only the browser knows the address it is on and whether it has a share sheet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === 'function');
  }, []);
  const url = share.slug && origin ? `${origin}/t/${share.slug}` : null;

  const change = (on: boolean, showAmounts: boolean) =>
    startTransition(async () => {
      const next = await setTripShare(tripId, on, showAmounts);
      if (!next) return setStatus(t('error'));
      if (next.slug && !share.slug) track('trip_shared');
      setShare(next);
      setStatus(next.slug ? t('on') : t('off'));
    });

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('title')}</h2>
      <p className={styles.hint}>{t('hint')}</p>
      {share.slug ? (
        <>
          <div className={styles.shareRow}>
            <input
              className={styles.shareUrl}
              readOnly
              value={url ?? ''}
              aria-label={t('linkLabel')}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className={styles.tool}
              onClick={async () => {
                if (!url) return;
                try {
                  await navigator.clipboard.writeText(url);
                  setStatus(t('copied'));
                } catch {
                  setStatus(t('copyFailed'));
                }
              }}
            >
              {t('copy')}
            </button>
          </div>
          <div className={styles.shareRow}>
            {canShare && url ? (
              <button
                type="button"
                className={styles.tool}
                onClick={() => navigator.share({ title, url }).catch(() => undefined)}
              >
                {t('send')}
              </button>
            ) : null}
            {url ? (
              <a
                className={styles.tool}
                href={`https://x.com/intent/post?${new URLSearchParams({ text: t('postText', { title }), url })}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('postX')}
              </a>
            ) : null}
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={share.showAmounts}
              disabled={pending}
              onChange={(event) => change(true, event.target.checked)}
            />
            {t('showAmounts')}
          </label>
          <button
            type="button"
            className={styles.ghost}
            disabled={pending}
            onClick={() => change(false, false)}
          >
            {t('stop')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles.tool}
          disabled={pending}
          onClick={() => change(true, false)}
        >
          {t('start')}
        </button>
      )}
      <p className={styles.hint} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
