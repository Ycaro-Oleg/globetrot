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
  type SuggestedPlan,
  type SuggestLike,
} from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type CSSProperties, type Ref } from 'react';
import { PipAvatar } from './app/_components/pip-avatar';
import type { PipPose } from './app/_components/pip-pose';
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

const STEPS = 4;
/** What Pip shows while the plan is put together, one after another. */
const PLANNING: readonly { line: 'planning1' | 'planning2' | 'planning3'; pose: PipPose }[] = [
  { line: 'planning1', pose: 'research' },
  { line: 'planning2', pose: 'draft' },
  { line: 'planning3', pose: 'deliver' },
];
const PLANNING_STEP_MS = 950;

function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== 'reduced' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

type Phase = number | 'planning' | 'done';

/**
 * "Where do you want to go?" on the landing: the app plans the trip, one question at a time (where, what you
 * enjoy, how long and how, how much a month), then Pip puts the plan together and the itinerary appears: stops,
 * nights, experiences worth it (some that few people talk about), legs, a typical cost per person and the month
 * the visitor can go. Nothing is sent anywhere; "Save this plan" carries the numbers into sign-up.
 */
export function LandingSuggest({ signupHref }: { signupHref: string }) {
  const t = useTranslations('landing.suggest');
  const locale = useLocale();
  const id = useId();
  const pt = locale.startsWith('pt');
  const [phase, setPhase] = useState<Phase>(0);
  const [planning, setPlanning] = useState(0);
  const [destination, setDestination] = useState<string>(SUGGESTED_DESTINATIONS[0]!.id);
  const [likes, setLikes] = useState<SuggestLike[]>(['adrenaline', 'food']);
  const [days, setDays] = useState(12);
  const [comfort, setComfort] = useState<SuggestComfort>('budget');
  const [code, setCode] = useState<Code>('USD');
  const [monthly, setMonthly] = useState(scaleOf('USD') / 10);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const currency = toCurrencyCode(code);
  const unit = 10n ** BigInt(minorUnitExponent(currency));
  const whole = (value: number) =>
    formatMoney(money(BigInt(Math.round(value)) * unit, currency), locale, { precision: 'whole' });
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  const max = scaleOf(code);
  const monthlyValue = Math.min(max, monthly);

  // Each new question (or the plan) takes the focus, so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (moved.current && phase !== 'planning') heading.current?.focus();
  }, [phase]);

  // Pip plans: three short beats, then the itinerary. Without motion the plan is there at once.
  useEffect(() => {
    if (phase !== 'planning') return;
    if (!motionAllowed()) {
      const frame = requestAnimationFrame(() => setPhase('done'));
      return () => cancelAnimationFrame(frame);
    }
    const timers = PLANNING.map((_, index) =>
      window.setTimeout(() => setPlanning(index), index * PLANNING_STEP_MS),
    );
    timers.push(window.setTimeout(() => setPhase('done'), PLANNING.length * PLANNING_STEP_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase]);

  const go = (next: Phase) => {
    moved.current = true;
    if (next === 'planning') setPlanning(0);
    setPhase(next);
  };
  const pickCurrency = (next: Code) => {
    setCode(next);
    setMonthly(scaleOf(next) / 10);
  };
  const toggleLike = (like: SuggestLike) =>
    setLikes((current) =>
      current.includes(like) ? current.filter((other) => other !== like) : [...current, like],
    );

  const plan = suggestPlan({ destination, likes, days, comfort })!;

  if (phase === 'planning') {
    const beat = PLANNING[planning]!;
    return (
      <section className={styles.calc} aria-labelledby={`${id}-title`} data-phase="planning">
        <div className={styles.planning} role="status">
          <PipAvatar size={120} pose={beat.pose} bare />
          <h2 id={`${id}-title`} className={styles.srOnly}>
            {t('planningLabel')}
          </h2>
          <p key={beat.line} className={styles.planningLine}>
            {t(beat.line)}
          </p>
          <span
            className={styles.planningBar}
            aria-hidden="true"
            style={{ '--progress': (planning + 1) / PLANNING.length } as CSSProperties}
          />
        </div>
      </section>
    );
  }

  if (phase === 'done') {
    return (
      <SuggestResult
        plan={plan}
        code={code}
        monthly={monthlyValue}
        headingRef={heading}
        onRestart={() => go(0)}
        signupHref={signupHref}
      />
    );
  }

  const step = phase;
  const titles = [t('title'), t('stepLikes'), t('stepDays'), t('stepMoney')];
  return (
    <section className={styles.calc} aria-labelledby={`${id}-title`} data-phase="steps">
      <div className={styles.calcHead}>
        <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className={styles.calcTitle}>
          {titles[step]}
        </h2>
        <span className={styles.stepCount}>{t('step', { n: step + 1, total: STEPS })}</span>
      </div>
      <div className={styles.stepBar} aria-hidden="true">
        {Array.from({ length: STEPS }, (_, index) => (
          <span key={index} data-on={index <= step || undefined} />
        ))}
      </div>

      <div key={step} className={styles.stepBody}>
        {step === 0 ? (
          <div className={styles.destinations} role="group" aria-labelledby={`${id}-title`}>
            {SUGGESTED_DESTINATIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={destination === option.id}
                onClick={() => setDestination(option.id)}
              >
                <strong>{pt ? option.namePt : option.name}</strong>
                <small>
                  {option.stops.map((stop) => (pt ? stop.namePt : stop.name)).join(' · ')}
                </small>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className={styles.calcField}>
            <span>{t('likesHint')}</span>
            <div className={styles.calcChips} role="group" aria-labelledby={`${id}-title`}>
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
        ) : null}

        {step === 2 ? (
          <div className={styles.calcFields}>
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
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.calcFields}>
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
        ) : null}
      </div>

      <div className={styles.stepActions}>
        {step > 0 ? (
          <button type="button" className={styles.stepBack} onClick={() => go(step - 1)}>
            <span aria-hidden="true">←</span> {t('back')}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={styles.cta}
          onClick={() => go(step < STEPS - 1 ? step + 1 : 'planning')}
        >
          {step < STEPS - 1 ? t('next') : t('build')} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

/**
 * The finished plan: the answer first (the estimate and the month), the way to keep it, then the itinerary stop
 * by stop. Separate so it renders the same for the landing and for its tests.
 */
export function SuggestResult({
  plan,
  code,
  monthly,
  signupHref,
  onRestart,
  headingRef,
}: {
  plan: SuggestedPlan;
  code: string;
  monthly: number;
  signupHref: string;
  onRestart: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations('landing.suggest');
  const why = useTranslations('suggest.why');
  const legModes = useTranslations('mapBoard.legModes');
  const locale = useLocale();
  const id = useId();
  const pt = locale.startsWith('pt');
  const [today] = useState(() => toLocalDate(new Date().toISOString().slice(0, 10)));
  const place = SUGGESTED_DESTINATIONS.find((candidate) => candidate.id === plan.destination)!;
  const currency = toCurrencyCode(code);
  const unit = 10n ** BigInt(minorUnitExponent(currency));
  const rate = suggestReferenceRate(code);
  const shown = (value: Money) => (rate ? convert(value, rate).converted : value);
  const format = (value: Money) => formatMoney(value, locale, { precision: 'whole' });
  const usd = (amount: number) => format(shown(money(BigInt(amount) * 100n, 'USD')));
  const whole = (value: number) => format(money(BigInt(Math.round(value)) * unit, currency));
  const monthName = (iso: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${iso.slice(0, 7)}-15T12:00:00Z`),
    );

  const middle = shown(plan.estimate.middle);
  const answer = livePlan({
    total: middle,
    saved: money(0n, currency),
    monthly: money(BigInt(Math.round(monthly)) * unit, currency),
    startDate: null,
    today,
  });
  const answerText =
    monthly > 0 && answer.readyMonth
      ? t('answer', { monthly: whole(monthly), month: monthName(answer.readyMonth) })
      : t('answerNone');

  const keep = () => {
    track('plan_saved');
    saveDraft({
      cost: String(Number(middle.amountMinor / unit)),
      saved: '0',
      monthly: String(Math.round(monthly)),
      currency: code,
      suggestion: { destination: plan.destination, days: plan.days },
    });
  };

  return (
    <section className={styles.calc} aria-labelledby={`${id}-title`} data-phase="done">
      <div className={styles.calcHead}>
        <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className={styles.calcTitle}>
          {t('planTitle', { destination: pt ? place.namePt : place.name, days: plan.days })}
        </h2>
        <button type="button" className={styles.stepBack} onClick={onRestart}>
          <span aria-hidden="true">↺</span> {t('restart')}
        </button>
      </div>
      <div className={styles.resultGrid}>
        <div className={styles.resultAnswer}>
          <PipAvatar size={72} pose="celebrate" bare />
          <p className={styles.resultRoute}>
            {plan.stops
              .map(
                ({ stop, nights }) =>
                  `${pt ? stop.namePt : stop.name} (${t('nights', { count: nights })})`,
              )
              .join(' → ')}
          </p>
          <strong className={styles.resultEstimate}>
            {t('estimate', {
              low: format(shown(plan.estimate.low)),
              high: format(shown(plan.estimate.high)),
            })}
          </strong>
          <p className={styles.planAnswer} suppressHydrationWarning>
            {answerText}
          </p>
          <small className={styles.resultNote}>
            {t('estimateNote', { date: monthName(SUGGEST_RESEARCHED_ON) })}
            {rate
              ? ` ${t('rateNote', {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  }).format(rate.asOf),
                })}`
              : ''}
          </small>
          <a href={signupHref} className={styles.cta} onClick={keep}>
            {t('cta')} <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className={styles.planResult} tabIndex={0} role="region" aria-label={t('itinerary')}>
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
        </div>
      </div>
    </section>
  );
}
