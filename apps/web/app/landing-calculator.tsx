'use client';

import { formatMoney, money, toLocalDate } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { livePlan, parseAmount } from './app/budget/budget-plan';
import styles from './landing.module.css';

import { track } from '../lib/analytics';
import { PLAN_DRAFT_COOKIE } from '../lib/plan-draft';

const DEFAULTS = { cost: '3000', saved: '500', monthly: '300' };
const MONTHLY_MAX = 3000;

/**
 * "Can I go?" on the landing page: three numbers in, the answer out, computed with the app's own savings rule
 * (`savingsPlan` through `livePlan`). Nothing is sent anywhere; "Save this plan" keeps the numbers in a cookie
 * so onboarding starts with them. Works without script: the server renders the default answer and the link.
 */
export function AnswerCalculator({ signupHref }: { signupHref: string }) {
  const t = useTranslations('landing.calc');
  const locale = useLocale();
  const id = useId();
  const [cost, setCost] = useState(DEFAULTS.cost);
  const [saved, setSaved] = useState(DEFAULTS.saved);
  const [monthly, setMonthly] = useState(DEFAULTS.monthly);
  const [touched, setTouched] = useState(false);
  const [today] = useState(() => toLocalDate(new Date().toISOString().slice(0, 10)));

  const usd = (text: string) => parseAmount(text || '0', 'USD');
  const total = usd(cost);
  const have = usd(saved);
  const perMonth = usd(monthly);
  const format = (minor: bigint) =>
    formatMoney(money(minor, 'USD'), locale, { precision: 'whole' });
  const monthName = (yyyyMm: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${yyyyMm}-15T12:00:00Z`),
    );

  let lead: string;
  let rest: string;
  let ok = false;
  if (!total || !have || !perMonth) {
    lead = t('checkLead');
    rest = t('check');
  } else {
    const plan = livePlan({ total, saved: have, monthly: perMonth, startDate: null, today });
    if (plan.status === 'no-costs') {
      lead = t('checkLead');
      rest = t('noCost');
    } else if (plan.status === 'fully-saved') {
      ok = true;
      lead = t('yes');
      rest = t('now');
    } else if (plan.readyMonth) {
      ok = true;
      lead = t('yes');
      rest = t('by', {
        month: monthName(plan.readyMonth),
        count: plan.monthsNeeded ?? 0,
        monthly: format(perMonth.amountMinor),
      });
    } else {
      lead = t('notYet');
      rest = t('needMonthly', { left: format(plan.left.amountMinor) });
    }
  }

  const keep = () => {
    const draft = JSON.stringify({ cost, saved, monthly });
    track('plan_saved');
    document.cookie = `${PLAN_DRAFT_COOKIE}=${encodeURIComponent(draft)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  };

  return (
    <section className={styles.calc} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.calcTitle}>
        {t('title')}
      </h2>
      <div className={styles.calcGrid}>
        <div className={styles.calcFields}>
          <label className={styles.calcField}>
            <span>{t('cost')}</span>
            <span className={styles.calcInput}>
              <span aria-hidden="true">US$</span>
              <input
                inputMode="decimal"
                value={cost}
                maxLength={9}
                onChange={(event) => {
                  setTouched(true);
                  setCost(event.target.value);
                }}
              />
            </span>
          </label>
          <label className={styles.calcField}>
            <span>{t('saved')}</span>
            <span className={styles.calcInput}>
              <span aria-hidden="true">US$</span>
              <input
                inputMode="decimal"
                value={saved}
                maxLength={9}
                onChange={(event) => {
                  setTouched(true);
                  setSaved(event.target.value);
                }}
              />
            </span>
          </label>
          <label className={styles.calcField} htmlFor={`${id}-monthly`}>
            <span>
              {t('monthly')} <strong>{perMonth ? format(perMonth.amountMinor) : '—'}</strong>
            </span>
            <input
              id={`${id}-monthly`}
              type="range"
              min={0}
              max={MONTHLY_MAX}
              step={25}
              value={Math.min(MONTHLY_MAX, Number(monthly) || 0)}
              onChange={(event) => {
                setTouched(true);
                setMonthly(event.target.value);
              }}
            />
          </label>
        </div>
        <div className={styles.calcAnswer} data-ok={ok || undefined}>
          <p
            key={`${lead}${rest}`}
            className={styles.calcSentence}
            data-changed={touched || undefined}
            aria-live="polite"
            suppressHydrationWarning
          >
            <span className={styles.calcLead}>{lead}</span> {rest}
          </p>
          <a href={signupHref} className={styles.cta} onClick={keep}>
            {t('cta')} <span aria-hidden="true">→</span>
          </a>
          <p className={styles.calcNote}>{t('note')}</p>
        </div>
      </div>
    </section>
  );
}
