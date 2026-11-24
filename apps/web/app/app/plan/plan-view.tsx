'use client';

import { formatMoney, money } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import type { BillingView } from '../../../lib/billing';
import { featureValues, monthlyOfAnnual, PLAN_CARDS, TOP_UP } from '../../../lib/plan-config';
import { openPortal, startCheckout } from './actions';
import styles from './plan.module.css';

type Interval = 'month' | 'year';

/** Plan & credits: where the person stands, what Pip has left, and the two plans to choose from. */
export function PlanView({
  billing,
  paid = null,
  planRequired = false,
}: {
  billing: BillingView | null;
  /** Back from a paid checkout: Stripe confirms it to us a moment later. */
  paid?: 'plan' | 'top-up' | null;
  /** Sent here because a change could not be saved in the read-only account. */
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
  const price = (minor: bigint) => formatMoney(money(minor, 'USD'), locale, { precision: 'full' });
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
        data-tone={billing.readOnly ? 'expired' : onPlan ? 'paid' : 'trial'}
      >
        {billing.readOnly ? (
          <>
            <h2>{t('expiredTitle')}</h2>
            <p role={planRequired ? 'status' : undefined}>
              {t(planRequired ? 'planRequiredBody' : 'expiredBody')}
            </p>
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
        ) : (
          <>
            <h2>{t('trialTitle', { days: billing.trialDaysLeft })}</h2>
            <p>{t('trialBody', { date: date(billing.trialEndsAt) })}</p>
          </>
        )}
      </div>

      {/* Credits and trip counts mean nothing without a plan: the read-only account sees the plans next. */}
      {billing.readOnly ? null : (
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
            {onPlan ? (
              <p className={styles.small}>
                {t('creditsReset', { date: date(billing.credits.periodEnd) })}
              </p>
            ) : null}
            {billing.credits.topUpLeft > 0 ? (
              <p className={styles.small}>{t('topUpLeft', { count: billing.credits.topUpLeft })}</p>
            ) : null}
            <p className={styles.small}>{p('credit')}</p>
            {!billing.readOnly ? (
              <button
                type="button"
                className={styles.secondary}
                disabled={pending}
                onClick={() => go(() => startCheckout('top-up', 'month'))}
              >
                {p('topUp', { credits: TOP_UP.credits, price: price(TOP_UP.priceMinor) })}
              </button>
            ) : null}
          </div>
          <div className={styles.fact}>
            <h2>{t('tripsTitle')}</h2>
            <p className={styles.meterText}>
              {t('trips', {
                count: billing.activeTrips,
                max: billing.maxActiveTrips === null ? 'none' : String(billing.maxActiveTrips),
              })}
            </p>
          </div>
        </div>
      )}

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
        {PLAN_CARDS.filter((plan) => plan.id !== 'trial').map((plan) => {
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

      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  );
}
