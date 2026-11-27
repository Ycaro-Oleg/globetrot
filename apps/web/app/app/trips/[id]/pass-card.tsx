'use client';

import { formatMoney, money, type PriceCurrency } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition } from 'react';
import { track } from '../../../../lib/analytics';
import { TRIP_PASS, tripPassPrice } from '../../../../lib/plan-config';
import { startCheckout } from '../../plan/actions';
import { redeemFreePass } from '../../_components/referral-actions';
import styles from './trip-hub.module.css';

/**
 * The trip pass (ADR-0023): one payment that opens everything paid on this trip, in the person's price currency.
 * Shows until when it holds once bought. Not shown on a paid plan, which already covers every trip.
 */
export function PassCard({
  tripId,
  currency,
  validUntil,
  justPaid,
  freePasses = 0,
}: {
  tripId: string;
  currency: PriceCurrency;
  validUntil: string | null;
  justPaid: boolean;
  /** Free passes earned by referring friends (ADR-0029). */
  freePasses?: number;
}) {
  const t = useTranslations('tripPass');
  const locale = useLocale();
  const id = useId();
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (justPaid) track('pass_bought');
  }, [justPaid]);
  const price = formatMoney(money(tripPassPrice(currency), currency), locale, {
    precision: 'full',
  });
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));

  const buy = () =>
    startTransition(async () => {
      setNotice('');
      const result = await startCheckout('trip-pass', 'month', tripId);
      if ('url' in result) {
        window.location.assign(result.url);
        return;
      }
      setNotice(result.error === 'unavailable' ? t('soon') : t('failed'));
    });

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('title')}</h2>
      {validUntil ? (
        <p>{t('active', { date: date(validUntil) })}</p>
      ) : (
        <>
          <p className={styles.hint}>{t('body', { credits: TRIP_PASS.credits })}</p>
          {justPaid ? <p role="status">{t('thanks')}</p> : null}
          {freePasses > 0 ? (
            <button
              type="button"
              className={styles.primary}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setNotice((await redeemFreePass(tripId)) ? t('freeUsed') : t('failed'));
                })
              }
            >
              {t('useFree', { count: freePasses })}
            </button>
          ) : null}
          <button
            type="button"
            className={freePasses > 0 ? styles.ghost : styles.primary}
            disabled={pending}
            onClick={buy}
          >
            {t('cta', { price })}
          </button>
        </>
      )}
      <p className={styles.hint} role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
