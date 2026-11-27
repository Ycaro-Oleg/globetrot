'use client';

import { formatMoney, money } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import type { BillingView } from '../../../lib/billing';
import Link from 'next/link';
import {
  featureValues,
  monthlyOfAnnual,
  planCards,
  TOP_UP,
  TOP_UP_SMALL,
  TRIP_PASS,
  topUpPrice,
  topUpSmallPrice,
  tripPassPrice,
} from '../../../lib/plan-config';
import { openPortal, startCheckout } from './actions';
import { ReferralCard } from './referral-card';
import styles from './plan.module.css';

type Interval = 'month' | 'year';

/** Plan & credits: where the person stands, what Pip has left, and the two plans to choose from. */
export function PlanView({
  billing,
  paid = null,
  planRequired = false,
  referral = null,
}: {
  billing: BillingView | null;
  /** The person's referral link and counts; null hides the card. */
  referral?: { code: string; joined: number; passCredits: number } | null;
  /** Back from a paid checkout: Stripe confirms it to us a moment later. */
  paid?: 'plan' | 'top-up' | null;
  /** Sent here because a change could not be saved: more trips are active than the plan keeps. */
  planRequired?: boolean;
}) {
  const t = useTranslations('planPage');
  const p = useTranslations('plans');
  const locale = useLocale();
  const id = useId();
  const [interval, setInterval] = useState<Interval>(
    billing?.interval === 'year' ? 'year' : 'month',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Reais for someone who chose reais as their currency, US dollars otherwise (the API decides, ADR-0023).
  const currency = billing?.priceCurrency ?? 'USD';
  const price = (minor: bigint) =>
    formatMoney(money(minor, currency), locale, { precision: 'full' });
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(iso),
    );

  const go = (action: () => Promise<{ url: string } | { error: string }>) => {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if ('url' in result) {
        window.location.assign(result.url);
        return;
      }
      setNotice(result.error === 'unavailable' ? t('checkoutSoon') : t('failed'));
    });
  };

  if (!billing) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p role="alert">{t('failed')}</p>
      </section>
    );
  }

  const onPlan = billing.access === 'explorer' || billing.access === 'voyager';
  const share = billing.credits.monthly
    ? Math.round((billing.credits.monthlyLeft / billing.credits.monthly) * 100)
    : 0;

  return (
    <section className={styles.page} aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className={styles.title}>
        {t('title')}
      </h1>

      {paid ? (
        <p className={styles.thanks} role="status">
          {t(paid === 'plan' ? 'thanksPlan' : 'thanksTopUp')}
        </p>
      ) : null}

      <div
        className={styles.status}
        data-tone={billing.overLimit ? 'expired' : onPlan ? 'paid' : 'trial'}
      >
        {billing.overLimit ? (
          <>
            <h2>{t('expiredTitle')}</h2>
            <p role={planRequired ? 'status' : undefined}>
              {t(planRequired ? 'planRequiredBody' : 'expiredBody')}
            </p>
            <Link href="/app/trips" className={styles.secondary}>
              {t('passTrips')}
            </Link>
          </>
        ) : onPlan ? (
          <>
            <h2>{t('paidTitle', { plan: p(`${billing.access}.name`) })}</h2>
            {billing.status === 'past_due' ? <p>{t('pastDue')}</p> : null}
            {billing.renewsAt ? <p>{t('renews', { date: date(billing.renewsAt) })}</p> : null}
            {billing.status === 'canceled' ? (
              <p>{t('ends', { date: date(billing.credits.periodEnd) })}</p>
            ) : null}
            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={() => go(openPortal)}
            >
              {t('manage')}
            </button>
          </>
        ) : billing.access === 'free' ? (
          <>
            <h2>{t('freeTitle')}</h2>
            <p>{t('freeBody', { credits: billing.credits.monthly })}</p>
          </>
        ) : (
          <>
            <h2>{t('trialTitle', { days: billing.trialDaysLeft })}</h2>
            <p>{t('trialBody', { date: date(billing.trialEndsAt) })}</p>
          </>
        )}
      </div>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <h2>{t('creditsTitle')}</h2>
          <p className={styles.meterText}>
            {t('creditsMeter', {
              left: billing.credits.monthlyLeft,
              total: billing.credits.monthly,
            })}
          </p>
          <div
            className={styles.meter}
            role="meter"
            aria-label={t('creditsTitle')}
            aria-valuemin={0}
            aria-valuemax={billing.credits.monthly}
            aria-valuenow={billing.credits.monthlyLeft}
            aria-valuetext={t('creditsMeter', {
              left: billing.credits.monthlyLeft,
              total: billing.credits.monthly,
            })}
          >
            <span style={{ width: `${share}%` }} />
          </div>
          {billing.access !== 'trial' ? (
            <p className={styles.small}>
              {t('creditsReset', { date: date(billing.credits.periodEnd) })}
            </p>
          ) : null}
          {billing.credits.topUpLeft > 0 ? (
            <p className={styles.small}>{t('topUpLeft', { count: billing.credits.topUpLeft })}</p>
          ) : null}
          <p className={styles.small}>{p('credit')}</p>
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={() => go(() => startCheckout('top-up-small', 'month'))}
          >
            {p('topUpSmall', {
              credits: TOP_UP_SMALL.credits,
              price: price(topUpSmallPrice(currency)),
            })}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={() => go(() => startCheckout('top-up', 'month'))}
          >
            {p('topUp', { credits: TOP_UP.credits, price: price(topUpPrice(currency)) })}
          </button>
        </div>
        <div className={styles.fact}>
          <h2>{t('tripsTitle')}</h2>
          <p className={styles.meterText}>
            {t('trips', {
              count: billing.countedTrips,
              max: billing.maxActiveTrips === null ? 'none' : String(billing.maxActiveTrips),
            })}
          </p>
          {billing.activeTrips > billing.countedTrips ? (
            <p className={styles.small}>
              {t('passCounted', { count: billing.activeTrips - billing.countedTrips })}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.plansHead} id="plans">
        <h2>{t('choosePlans')}</h2>
        <div className={styles.toggle} role="group" aria-label={p('billing')}>
          {(['month', 'year'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
            >
              {value === 'month' ? p('monthly') : p('annual')}
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.plans}>
        {planCards(currency)
          .filter((plan) => plan.id !== 'free')
          .map((plan) => {
            const current = onPlan && billing.access === plan.id && billing.interval === interval;
            const yearly = interval === 'year';
            return (
              <li
                key={plan.id}
                className={styles.plan}
                data-highlighted={plan.highlighted || undefined}
              >
                <div className={styles.planTop}>
                  <h3>{p(`${plan.id}.name`)}</h3>
                  {plan.highlighted ? <span className={styles.badge}>{p('popular')}</span> : null}
                </div>
                <p className={styles.price}>
                  <strong>{price(yearly ? plan.annualMinor : plan.monthlyMinor)}</strong>
                  <span>{yearly ? p('perYear') : p('perMonth')}</span>
                </p>
                <p className={styles.small}>
                  {yearly
                    ? p('annualNote', { monthly: price(monthlyOfAnnual(plan.annualMinor)) })
                    : p(`${plan.id}.tagline`)}
                </p>
                <ul className={styles.features}>
                  {(['f1', 'f2', 'f3'] as const).map((feature) => (
                    <li key={feature}>
                      <span aria-hidden="true">✓</span>
                      {p(`${plan.id}.${feature}`, featureValues(plan))}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <p className={styles.current}>{t('current')}</p>
                ) : (
                  <button
                    type="button"
                    className={styles.cta}
                    disabled={pending}
                    onClick={() =>
                      go(() => startCheckout(plan.id as 'explorer' | 'voyager', interval))
                    }
                  >
                    {t('choose', { plan: p(`${plan.id}.name`) })}
                  </button>
                )}
              </li>
            );
          })}
      </ul>

      {onPlan ? null : (
        <div className={styles.fact}>
          <h2>{t('passTitle')}</h2>
          <p>
            {t('passBody', {
              price: price(tripPassPrice(currency)),
              credits: TRIP_PASS.credits,
            })}
          </p>
          <Link href="/app/trips" className={styles.secondary}>
            {t('passTrips')}
          </Link>
        </div>
      )}

      {referral ? <ReferralCard referral={referral} /> : null}

      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
