'use client';

import { formatMoney, money } from '@globetrot/domain';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { featureValues, monthlyOfAnnual, PLAN_CARDS, TOP_UP } from '../lib/plan-config';
import styles from './landing.module.css';

type Decision = 'pending' | 'approved' | 'dismissed';

/**
 * The Pip demo (design handoff v2): three proposed changes a visitor can approve or dismiss. It only changes this
 * page, and says so: Pip proposes, the person decides.
 */
export function PipDemo() {
  const t = useTranslations('landing');
  const [decisions, setDecisions] = useState<Decision[]>(['pending', 'pending', 'pending']);
  const decide = (index: number, decision: Decision) =>
    setDecisions((current) => current.map((value, i) => (i === index ? decision : value)));

  return (
    <div className={styles.pipPanel}>
      <p className={styles.pipSays}>{t('pipSays')}</p>
      <ul className={styles.changes}>
        {([1, 2, 3] as const).map((n, index) => {
          const decision = decisions[index]!;
          return (
            <li key={n} className={styles.change} data-decision={decision}>
              <div>
                <strong>{t(`pipChange${n}`)}</strong>
                <span>{t(`pipWhy${n}`)}</span>
              </div>
              {decision === 'pending' ? (
                <div className={styles.changeActions}>
                  <button
                    type="button"
                    className={styles.approve}
                    onClick={() => decide(index, 'approved')}
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    className={styles.dismiss}
                    onClick={() => decide(index, 'dismissed')}
                  >
                    {t('dismiss')}
                  </button>
                </div>
              ) : (
                <span className={styles.decided} role="status">
                  {decision === 'approved' ? `✓ ${t('approved')}` : `× ${t('dismissed')}`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.demoNote}>{t('pipDemoNote')}</p>
    </div>
  );
}

/** The free week and the two plans, with a monthly / yearly switch. Everyone starts with the trial. */
export function Pricing() {
  const t = useTranslations('landing');
  const p = useTranslations('plans');
  const locale = useLocale();
  const [annual, setAnnual] = useState(false);
  const price = (minor: bigint) =>
    formatMoney(money(minor, 'USD'), locale, { precision: minor === 0n ? 'whole' : 'full' });

  return (
    <>
      <div className={styles.pricingHead}>
        <div className={styles.heading}>
          <span className={styles.kicker}>{t('pricingKicker')}</span>
          <h2 id="pricing-title">{t('pricingTitle')}</h2>
        </div>
        <div className={styles.billing} role="group" aria-label={p('billing')}>
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
            {p('monthly')}
          </button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
            {p('annual')}
          </button>
        </div>
      </div>
      <ul className={styles.plans}>
        {PLAN_CARDS.map((plan) => {
          const trial = plan.id === 'trial';
          return (
            <li
              key={plan.id}
              className={styles.plan}
              data-highlighted={plan.highlighted || undefined}
            >
              <div className={styles.planTop}>
                <h3>{p(`${plan.id}.name`)}</h3>
                {plan.highlighted ? <span className={styles.popular}>{p('popular')}</span> : null}
              </div>
              <p className={styles.planPrice}>
                {trial ? (
                  <strong>{p('trial.price')}</strong>
                ) : (
                  <>
                    <strong>{price(annual ? plan.annualMinor : plan.monthlyMinor)}</strong>
                    <span>{annual ? p('perYear') : p('perMonth')}</span>
                  </>
                )}
              </p>
              <p className={styles.planNote}>
                {!trial && annual
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
              <Link href="/signup" className={styles.planCta}>
                {p(`${plan.id}.cta`)}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className={styles.placeholderNote}>
        {p('topUp', { credits: TOP_UP.credits, price: price(TOP_UP.priceMinor) })} {p('credit')}
      </p>
    </>
  );
}
