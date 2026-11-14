'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { track } from '../../../lib/analytics';
import { ensureTripShare } from './trip-actions';

/**
 * "Share my trip" at a moment worth showing (a stamp earned): turns the trip's link on if needed, then opens the
 * phone's share sheet, or copies the link where there is none. The trip's page is where it is managed or stopped.
 */
export function ShareTripButton({
  tripId,
  title,
  className,
}: {
  tripId: string;
  title: string;
  className?: string | undefined;
}) {
  const t = useTranslations('tripHub.share');
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();

  const share = () =>
    startTransition(async () => {
      const slug = await ensureTripShare(tripId);
      if (!slug) return setStatus(t('error'));
      const url = `${window.location.origin}/t/${slug}`;
      track('trip_shared');
      if (typeof navigator.share === 'function') {
        await navigator
          .share({ title, text: t('postText', { title }), url })
          .catch(() => undefined);
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setStatus(t('copied'));
      } catch {
        setStatus(url);
      }
    });

  return (
    <>
      <button type="button" className={className} disabled={pending} onClick={share}>
        {t('shareMoment')}
      </button>
      <span role="status" aria-live="polite" style={{ fontSize: 14 }}>
        {status}
      </span>
    </>
  );
}
