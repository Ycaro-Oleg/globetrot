'use client';

import { formatMoney, money, PRICE_CURRENCIES, type PriceCurrency } from '@globetrot/domain';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  featureValues,
  monthlyOfAnnual,
  planCards,
  TOP_UP,
  topUpPrice,
  tripPassPrice,
} from '../lib/plan-config';
import { pipReact } from './landing-pip';
import styles from './landing.module.css';

type Decision = 'pending' | 'approved' | 'dismissed';

/**
 * The Pip demo (design handoff v2): three proposed changes a visitor can approve or dismiss. It only changes this
 * page, and says so: Pip proposes, the person decides.
 */
export function PipDemo() {
  const t = useTranslations('landing');
  const [decisions, setDecisions] = useState<Decision[]>(['pending', 'pending', 'pending']);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  const decide = (index: number, decision: Decision, button: HTMLElement | null) => {
    setDecisions((current) => current.map((value, i) => (i === index ? decision : value)));
    pipReact(decision === 'approved' ? 'celebrate' : 'unsure');
    const row = rows.current[index];
    if (!row) return;
    if (decision === 'approved') void celebrate(row, button);
    else void shake(row);
  };

  return (
    <div className={styles.pipPanel}>
      <p className={styles.pipSays}>{t('pipSays')}</p>
      <ul className={styles.changes}>
        {([1, 2, 3] as const).map((n, index) => {
          const decision = decisions[index]!;
          return (
            <li
              key={n}
              ref={(element) => {
                rows.current[index] = element;
              }}
              className={styles.change}
              data-decision={decision}
            >
              <div>
                <strong>{t(`pipChange${n}`)}</strong>
                <span>{t(`pipWhy${n}`)}</span>
              </div>
              {decision === 'pending' ? (
                <div className={styles.changeActions}>
                  <button
                    type="button"
                    className={styles.approve}
                    onClick={(event) => decide(index, 'approved', event.currentTarget)}
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    className={styles.dismiss}
                    onClick={(event) => decide(index, 'dismissed', event.currentTarget)}
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
      {decisions.every((decision) => decision !== 'pending') ? (
        <button
          type="button"
          className={styles.replay}
          onClick={() => setDecisions(['pending', 'pending', 'pending'])}
        >
          ↺ {t('pipReplay')}
        </button>
      ) : null}
      <p className={styles.demoNote}>{t('pipDemoNote')}</p>
    </div>
  );
}

/** Approve: the row pops, flashes green and throws a little confetti from the button. */
async function celebrate(row: HTMLElement, button: HTMLElement | null) {
  if (!motionAllowed()) return;
  const { gsap } = await import('gsap');
  gsap.fromTo(row, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
  gsap.fromTo(
    row,
    { backgroundColor: '#d1fae5' },
    {
      backgroundColor: '#ffffff',
      duration: 0.9,
      ease: 'power1.out',
      clearProps: 'backgroundColor',
    },
  );
  // A little confetti from where the button was.
  const origin = button?.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  const x = origin ? origin.left - box.left + origin.width / 2 : box.width - 60;
  const y = origin ? origin.top - box.top + origin.height / 2 : box.height / 2;
  const colors = ['#f97316', '#2563eb', '#10b981', '#f59e0b', '#ec4899'];
  for (let i = 0; i < 14; i++) {
    const bit = document.createElement('span');
    bit.className = styles.confetti!;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = colors[i % colors.length]!;
    row.appendChild(bit);
    gsap.to(bit, {
      x: (Math.random() - 0.5) * 160,
      y: -30 - Math.random() * 70,
      rotate: Math.random() * 360,
      opacity: 0,
      duration: 0.9 + Math.random() * 0.4,
      ease: 'power2.out',
      onComplete: () => bit.remove(),
    });
  }
}

async function shake(row: HTMLElement) {
  if (!motionAllowed()) return;
  const { gsap } = await import('gsap');
  gsap.fromTo(row, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
}

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The free plan, the two paid plans and the trip pass, with a monthly / yearly switch and the price currency the
 * visitor picks (US dollars until they choose; never guessed from the language).
 */
export function Pricing() {
  const t = useTranslations('landing');
  const p = useTranslations('plans');
  const locale = useLocale();
  const [annual, setAnnual] = useState(false);
  const [currency, setCurrency] = useState<PriceCurrency>('USD');
  const price = (minor: bigint) =>
    formatMoney(money(minor, currency), locale, { precision: minor === 0n ? 'whole' : 'full' });

  return (
    <>
      <div className={styles.pricingHead}>
        <div className={styles.heading}>
          <span className={styles.kicker}>{t('pricingKicker')}</span>
          <h2 id="pricing-title">{t('pricingTitle')}</h2>
        </div>
        <div className={styles.pricingSwitches}>
          <div className={styles.billing} role="group" aria-label={p('billing')}>
            <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
              {p('monthly')}
            </button>
            <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
              {p('annual')}
            </button>
          </div>
          <div className={styles.billing} role="group" aria-label={p('currency')}>
            {PRICE_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={currency === code}
                onClick={() => setCurrency(code)}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ul className={styles.plans}>
        {planCards(currency).map((plan) => {
          const free = plan.id === 'free';
          const features = free
            ? (['f1', 'f2', 'f3', 'f4'] as const)
            : (['f1', 'f2', 'f3'] as const);
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
                {free ? (
                  <strong>{p('free.price')}</strong>
                ) : (
                  <>
                    <strong>{price(annual ? plan.annualMinor : plan.monthlyMinor)}</strong>
                    <span>{annual ? p('perYear') : p('perMonth')}</span>
                  </>
                )}
              </p>
              <p className={styles.planNote}>
                {!free && annual
                  ? p('annualNote', { monthly: price(monthlyOfAnnual(plan.annualMinor)) })
                  : p(`${plan.id}.tagline`)}
              </p>
              <ul className={styles.features}>
                {features.map((feature) => (
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
      <div className={styles.passRow}>
        <div>
          <h3>{p('pass.name')}</h3>
          <p className={styles.planPrice}>
            <strong>{price(tripPassPrice(currency))}</strong>
            <span>{p('pass.once')}</span>
          </p>
        </div>
        <div>
          <p className={styles.planNote}>{p('pass.tagline')}</p>
          <ul className={styles.features}>
            {(['f1', 'f2', 'f3'] as const).map((feature) => (
              <li key={feature}>
                <span aria-hidden="true">✓</span>
                {p(`pass.${feature}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className={styles.placeholderNote}>
        {p('topUp', { credits: TOP_UP.credits, price: price(topUpPrice(currency)) })} {p('credit')}
      </p>
    </>
  );
}
