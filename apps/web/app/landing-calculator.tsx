'use client';

import {
  formatMoney,
  minorUnitExponent,
  money,
  toCurrencyCode,
  toLocalDate,
} from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type CSSProperties } from 'react';
import { livePlan, parseAmount } from './app/budget/budget-plan';
import styles from './landing.module.css';

import { track } from '../lib/analytics';
import { PLAN_DRAFT_COOKIE } from '../lib/plan-draft';

/**
 * The main currencies offered, each with the top of its monthly slider (a round number in that currency,
 * not a conversion). The example numbers, the slider marks and the one-tap amounts follow from it.
 * USD comes first because it is the product default, never because of the visitor's language or country.
 */
const CURRENCIES = [
  ['USD', 3000],
  ['EUR', 3000],
  ['GBP', 3000],
  ['BRL', 15000],
  ['CAD', 4500],
  ['AUD', 4500],
  ['MXN', 60000],
  ['JPY', 450000],
  ['CHF', 3000],
  ['INR', 300000],
] as const;
type Code = (typeof CURRENCIES)[number][0];
const scaleOf = (code: Code) => CURRENCIES.find(([candidate]) => candidate === code)![1];
/** The example trip for a slider top: the trip costs the top, a sixth is saved, a tenth goes in each month. */
const examples = (max: number) => ({
  cost: String(max),
  saved: String(max / 6),
  monthly: String(max / 10),
});
/** One-tap monthly amounts under the slider, as shares of its top. */
const QUICK_SHARES = [30, 10, 6, 3];

/**
 * "Can I go?" on the landing page: three numbers in, the answer out, computed with the app's own savings rule
 * (`savingsPlan` through `livePlan`). Nothing is sent anywhere; "Save this plan" keeps the numbers in a cookie
 * so onboarding starts with them. Works without script: the server renders the default answer and the link.
 */
export function AnswerCalculator({ signupHref }: { signupHref: string }) {
  const t = useTranslations('landing.calc');
  const locale = useLocale();
  const id = useId();
  const [code, setCode] = useState<Code>('USD');
  const MONTHLY_MAX = scaleOf(code);
  const [cost, setCost] = useState(examples(MONTHLY_MAX).cost);
  const [saved, setSaved] = useState(examples(MONTHLY_MAX).saved);
  const [monthly, setMonthly] = useState(examples(MONTHLY_MAX).monthly);
  const [touched, setTouched] = useState(false);
  const [today] = useState(() => toLocalDate(new Date().toISOString().slice(0, 10)));

  const currency = toCurrencyCode(code);
  const unit = 10n ** BigInt(minorUnitExponent(currency));
  const amount = (text: string) => parseAmount(text || '0', code);
  const total = amount(cost);
  const have = amount(saved);
  const perMonth = amount(monthly);
  const monthlyValue = Math.min(MONTHLY_MAX, Number(monthly) || 0);
  const format = (minor: bigint) =>
    formatMoney(money(minor, currency), locale, { precision: 'whole' });
  const whole = (value: number) => format(BigInt(Math.round(value)) * unit);
  const symbol =
    new Intl.NumberFormat(locale, { style: 'currency', currency: code })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? code;
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  const step = MONTHLY_MAX / 60;
  const quick = QUICK_SHARES.map((share) => MONTHLY_MAX / share);

  const pickCurrency = (next: Code) => {
    setCode(next);
    // Untouched example numbers follow the currency; numbers the person typed stay as typed.
    if (!touched) {
      const example = examples(scaleOf(next));
      setCost(example.cost);
      setSaved(example.saved);
      setMonthly(example.monthly);
    }
  };
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
    const draft = JSON.stringify({ cost, saved, monthly, currency: code });
    track('plan_saved');
    document.cookie = `${PLAN_DRAFT_COOKIE}=${encodeURIComponent(draft)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  };

  return (
    <section className={styles.calc} aria-labelledby={`${id}-title`}>
      <div className={styles.calcHead}>
        <h2 id={`${id}-title`} className={styles.calcTitle}>
          {t('title')}
        </h2>
        <label className={styles.calcCurrency}>
          <span>{t('currency')}</span>
          <select value={code} onChange={(event) => pickCurrency(event.target.value as Code)}>
            {CURRENCIES.map(([option]) => (
              <option key={option} value={option}>
                {option} · {names.of(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.calcGrid}>
        <div className={styles.calcFields}>
          <label className={styles.calcField}>
            <span>{t('cost')}</span>
            <span className={styles.calcInput}>
              <span aria-hidden="true">{symbol}</span>
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
              <span aria-hidden="true">{symbol}</span>
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
          <div className={styles.calcField}>
            <label htmlFor={`${id}-monthly`}>
              {t('monthly')} <strong>{perMonth ? format(perMonth.amountMinor) : '—'}</strong>
            </label>
            <div
              className={styles.calcSlider}
              style={{ '--fill': monthlyValue / MONTHLY_MAX } as CSSProperties}
            >
              <span className={styles.calcBubble} aria-hidden="true">
                {whole(monthlyValue)}
              </span>
              <input
                id={`${id}-monthly`}
                className={styles.calcRange}
                type="range"
                min={0}
                max={MONTHLY_MAX}
                step={step}
                value={monthlyValue}
                onChange={(event) => {
                  setTouched(true);
                  setMonthly(event.target.value);
                }}
              />
              <span className={styles.calcTicks} aria-hidden="true">
                {[0, MONTHLY_MAX / 2, MONTHLY_MAX].map((tick) => (
                  <span key={tick}>{whole(tick)}</span>
                ))}
              </span>
            </div>
            <div className={styles.calcChips} role="group" aria-label={t('quickMonthly')}>
              {quick.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={monthlyValue === value}
                  onClick={() => {
                    setTouched(true);
                    setMonthly(String(value));
                  }}
                >
                  {whole(value)}
                </button>
              ))}
            </div>
          </div>
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
