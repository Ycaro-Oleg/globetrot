'use client';

import {
  convert,
  formatMoney,
  minorUnitExponent,
  money,
  SUGGEST_COMFORTS,
  SUGGEST_LIKES,
  SUGGEST_MAX_DAYS,
  SUGGEST_MIN_DAYS,
  SUGGEST_RESEARCHED_ON,
  SUGGESTED_DESTINATIONS,
  suggestPlan,
  suggestReferenceRate,
  toCurrencyCode,
  toLocalDate,
  type Money,
  type SuggestComfort,
  type SuggestLike,
} from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type CSSProperties } from 'react';
import { livePlan } from './app/budget/budget-plan';
import styles from './landing.module.css';
import { track } from '../lib/analytics';
import { saveDraft } from '../lib/plan-draft';

/**
 * The currencies offered, each with the top of its monthly slider (a round number in that currency, not a
 * conversion). USD first because it is the product default, never because of the visitor's language or country.
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
/** One-tap monthly amounts under the slider, as shares of its top. */
const QUICK_SHARES = [30, 10, 6, 3];

/**
 * "Where do you want to go?" on the landing: the app plans the trip. Pick a destination, what you enjoy, how many
 * days and how you travel, and Globetrot lays out the stops, the experiences worth it (some that few people talk
 * about), how to get between them and a typical cost per person from its researched ranges; then how much to
 * save each month to go. Nothing is sent anywhere; "Save this plan" carries the numbers into sign-up.
 */
export function LandingSuggest({ signupHref }: { signupHref: string }) {
  const t = useTranslations('landing.suggest');
  const why = useTranslations('suggest.why');
  const legModes = useTranslations('mapBoard.legModes');
  const locale = useLocale();
  const id = useId();
  const pt = locale.startsWith('pt');
  const [destination, setDestination] = useState<string>(SUGGESTED_DESTINATIONS[0]!.id);
  const [likes, setLikes] = useState<SuggestLike[]>(['adrenaline', 'food']);
  const [days, setDays] = useState(12);
  const [comfort, setComfort] = useState<SuggestComfort>('budget');
  const [code, setCode] = useState<Code>('USD');
  const [monthly, setMonthly] = useState(scaleOf('USD') / 10);
  const [today] = useState(() => toLocalDate(new Date().toISOString().slice(0, 10)));

  const plan = suggestPlan({ destination, likes, days, comfort })!;
  const place = SUGGESTED_DESTINATIONS.find((candidate) => candidate.id === destination)!;
  const currency = toCurrencyCode(code);
  const unit = 10n ** BigInt(minorUnitExponent(currency));
  const rate = suggestReferenceRate(code);
  const shown = (value: Money) => (rate ? convert(value, rate).converted : value);
  const format = (value: Money) => formatMoney(value, locale, { precision: 'whole' });
  const usd = (whole: number) => format(shown(money(BigInt(whole) * 100n, 'USD')));
  const whole = (value: number) => format(money(BigInt(Math.round(value)) * unit, currency));
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${iso.slice(0, 7)}-15T12:00:00Z`),
    );
  const names = new Intl.DisplayNames([locale], { type: 'currency' });

  const max = scaleOf(code);
  const monthlyValue = Math.min(max, monthly);
  const middle = shown(plan.estimate.middle);
  const perMonth = money(BigInt(Math.round(monthlyValue)) * unit, currency);
  const answer = livePlan({
    total: middle,
    saved: money(0n, currency),
    monthly: perMonth,
    startDate: null,
    today,
  });
  const answerText =
    monthlyValue > 0 && answer.readyMonth
      ? t('answer', { monthly: whole(monthlyValue), month: day(answer.readyMonth) })
      : t('answerNone');

  const pickCurrency = (next: Code) => {
    setCode(next);
    setMonthly(scaleOf(next) / 10);
  };
  const toggleLike = (like: SuggestLike) =>
    setLikes((current) =>
      current.includes(like) ? current.filter((other) => other !== like) : [...current, like],
    );

  const keep = () => {
    const major = (value: Money) => String(Number(value.amountMinor / unit));
    track('plan_saved');
    saveDraft({
      cost: major(middle),
      saved: '0',
      monthly: String(Math.round(monthlyValue)),
      currency: code,
      suggestion: { destination, likes, days, comfort },
    });
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
          <div className={styles.calcField}>
            <span id={`${id}-where`}>{t('destination')}</span>
            <div className={styles.calcChips} role="group" aria-labelledby={`${id}-where`}>
              {SUGGESTED_DESTINATIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={destination === option.id}
                  onClick={() => setDestination(option.id)}
                >
                  {pt ? option.namePt : option.name}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.calcField}>
            <span id={`${id}-likes`}>{t('likesLabel')}</span>
            <div className={styles.calcChips} role="group" aria-labelledby={`${id}-likes`}>
              {SUGGEST_LIKES.map((like) => (
                <button
                  key={like}
                  type="button"
                  aria-pressed={likes.includes(like)}
                  onClick={() => toggleLike(like)}
                >
                  {t(`likes.${like}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.calcField}>
            <label htmlFor={`${id}-days`}>
              {t('daysLabel')} <strong>{t('days', { count: days })}</strong>
            </label>
            <input
              id={`${id}-days`}
              className={styles.calcRange}
              style={
                {
                  '--fill': (days - SUGGEST_MIN_DAYS) / (SUGGEST_MAX_DAYS - SUGGEST_MIN_DAYS),
                } as CSSProperties
              }
              type="range"
              min={SUGGEST_MIN_DAYS}
              max={SUGGEST_MAX_DAYS}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            />
          </div>
          <div className={styles.calcField}>
            <span id={`${id}-comfort`}>{t('comfortLabel')}</span>
            <div className={styles.calcChips} role="group" aria-labelledby={`${id}-comfort`}>
              {SUGGEST_COMFORTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={comfort === option}
                  onClick={() => setComfort(option)}
                >
                  {t(`comfort.${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.calcField}>
            <label htmlFor={`${id}-monthly`}>
              {t('monthly')} <strong>{whole(monthlyValue)}</strong>
            </label>
            <input
              id={`${id}-monthly`}
              className={styles.calcRange}
              style={{ '--fill': monthlyValue / max } as CSSProperties}
              type="range"
              min={0}
              max={max}
              step={max / 60}
              value={monthlyValue}
              onChange={(event) => setMonthly(Number(event.target.value))}
            />
            <div className={styles.calcChips} role="group" aria-label={t('quickMonthly')}>
              {QUICK_SHARES.map((share) => (
                <button
                  key={share}
                  type="button"
                  aria-pressed={monthlyValue === max / share}
                  onClick={() => setMonthly(max / share)}
                >
                  {whole(max / share)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.planResult}>
          <h3 className={styles.planTitle}>
            {t('planTitle', { destination: pt ? place.namePt : place.name, days: plan.days })}
          </h3>
          <ol className={styles.planStops}>
            {plan.stops.map(({ stop, nights, experiences, next }, index) => {
              const after = plan.stops[index + 1];
              return (
                <li key={stop.key}>
                  <div className={styles.planStopHead}>
                    <strong>{pt ? stop.namePt : stop.name}</strong>
                    <span>{t('nights', { count: nights })}</span>
                  </div>
                  <ul className={styles.planExperiences}>
                    {experiences.map((experience) => (
                      <li key={experience.id}>
                        <span className={styles.planExperienceName}>
                          {pt ? experience.namePt : experience.name}
                          {experience.offbeat ? (
                            <em className={styles.planOffbeat}>{t('offbeat')}</em>
                          ) : null}
                        </span>
                        <small>{why(experience.id)}</small>
                        <span className={styles.planCost}>
                          {experience.cost[1] === 0
                            ? t('free')
                            : experience.cost[0] === experience.cost[1]
                              ? t('cost', { amount: usd(experience.cost[1]) })
                              : experience.cost[0] === 0
                                ? t('costUpTo', { high: usd(experience.cost[1]) })
                                : t('costRange', {
                                    low: usd(experience.cost[0]),
                                    high: usd(experience.cost[1]),
                                  })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {next && after ? (
                    <p className={styles.planLeg}>
                      {t('leg', {
                        mode: legModes(next.mode),
                        place: pt ? after.stop.namePt : after.stop.name,
                      })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className={styles.planEstimate} aria-live="polite">
            <strong>
              {t('estimate', {
                low: format(shown(plan.estimate.low)),
                high: format(shown(plan.estimate.high)),
              })}
            </strong>
            <small>
              {t('estimateNote', { date: day(SUGGEST_RESEARCHED_ON) })}
              {rate
                ? ` ${t('rateNote', {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: 'UTC',
                    }).format(rate.asOf),
                  })}`
                : ''}
            </small>
            <p className={styles.planAnswer} suppressHydrationWarning>
              {answerText}
            </p>
          </div>
          <a href={signupHref} className={styles.cta} onClick={keep}>
            {t('cta')} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
