'use client';

import { currencyOfCountry, formatMoney, money, toLocalDate, type Money } from '@globetrot/domain';
import { formatYearMonth, type SupportedLocale } from '@globetrot/i18n';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { track } from '../../lib/analytics';
import { confetti } from '../../lib/confetti';
import { livePlan, parseAmount } from '../app/budget/budget-plan';
import { SITE_NAME } from '../site';
import { currencyOptions } from '../settings/options';
import { finishOnboarding, type OnboardingPlace } from './actions';
import { CityPicker } from './city-picker';
import { PipIntro } from './pip-intro';
import { TripPip } from './trip-pip';
import { TripVisual } from './trip-visual';
import { nightsOf, TripDates, type TripRange } from './trip-dates';
import styles from './onboarding.module.css';

const LAST = 6;

function todayLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return toLocalDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/**
 * The first trip in seven steps (design handoff v2, "Onboarding"): welcome, home city, destination, month and
 * length, money, Pip, and the answer. The answer uses the domain's savings rule on the person's own rough guess,
 * labelled as an estimate. "Open my map" creates the real trip through the API and opens the board.
 */
export function OnboardingFlow({
  currency,
  homeCity: initialHomeCity,
  homePoint = null,
  pipOptIn: initialPip,
  draft = null,
  land = '',
}: {
  /** The world's countries as one SVG path (drawn on the server), for the live trip map. */
  land?: string;
  currency: string;
  homeCity: string;
  homePoint?: { latitude: number; longitude: number } | null;
  pipOptIn: boolean;
  /** Numbers tried on the landing page's "Can I go?", to start the money step with. */
  draft?: { cost: string; saved: string; monthly: string; currency: string | null } | null;
}) {
  const t = useTranslations('onboarding');
  const locale = useLocale() as SupportedLocale;
  const [step, setStep] = useState(0);
  const [home, setHome] = useState<OnboardingPlace | null>(
    initialHomeCity
      ? {
          key: null,
          name: initialHomeCity,
          countryCode: null,
          region: null,
          latitude: homePoint?.latitude ?? null,
          longitude: homePoint?.longitude ?? null,
        }
      : null,
  );
  const [destination, setDestination] = useState<OnboardingPlace | null>(null);
  const [range, setRange] = useState<TripRange | null>(null);
  const nights = nightsOf(range);
  const month = range ? range.start.slice(0, 7) : null;
  // The trip's money is in the destination's currency unless the person picks another one
  // (here, or already on the landing page's "Can I go?").
  const [tripCurrency, setTripCurrency] = useState(draft?.currency ?? currency);
  const [currencyPicked, setCurrencyPicked] = useState(Boolean(draft?.currency));
  const [direction, setDirection] = useState(1);
  const content = useRef<HTMLDivElement>(null);
  const answerCard = useRef<HTMLDivElement>(null);
  const [estimate, setEstimate] = useState(draft?.cost ?? '');
  const [saved, setSaved] = useState(draft?.saved ?? '0');
  const [monthly, setMonthly] = useState(draft?.monthly ?? '300');
  const [pip, setPip] = useState(initialPip);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(todayLocal);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    // Each step slides in from the side it comes from (GSAP), unless the person asked for less motion.
    const element = content.current;
    if (
      !element ||
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    let cancelled = false;
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      gsap.fromTo(
        element.children,
        { opacity: 0, x: 28 * direction },
        {
          opacity: 1,
          x: 0,
          duration: 0.45,
          ease: 'power3.out',
          stagger: 0.05,
          clearProps: 'transform,opacity',
        },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [step, direction]);

  // The answer lands with a pop; a "yes" throws confetti.
  useEffect(() => {
    const card = answerCard.current;
    if (step !== LAST || !card) return;
    if (
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    void import('gsap').then(({ gsap }) => {
      gsap.fromTo(
        card,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, delay: 0.25, ease: 'back.out(2)' },
      );
    });
    if (card.dataset.ok !== undefined) {
      const timer = window.setTimeout(
        () => void confetti(card, { x: card.clientWidth / 2, y: 30 }),
        600,
      );
      return () => window.clearTimeout(timer);
    }
  }, [step]);

  const chooseDestination = (place: OnboardingPlace | null) => {
    setDestination(place);
    setError(null);
    if (!currencyPicked) setTripCurrency(currencyOfCountry(place?.countryCode) ?? currency);
  };

  const fmt = (value: Money) => formatMoney(value, locale, { precision: 'whole' });
  const zero = money(0n, tripCurrency);
  const estimateMoney = parseAmount(estimate, tripCurrency);
  const savedMoney = parseAmount(saved, tripCurrency) ?? zero;
  const monthlyMoney = parseAmount(monthly, tripCurrency) ?? zero;

  const validate = (): string | null => {
    if (step === 2 && !destination) return t('errDest');
    if (step === 3 && (!range || nights < 1)) return t('errDates');
    if (step === 4 && (!estimateMoney || estimateMoney.amountMinor <= 0n)) return t('errEstimate');
    return null;
  };
  const next = (event?: FormEvent) => {
    event?.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (step < LAST) {
      setDirection(1);
      setStep(step + 1);
      return;
    }
    if (!destination || !range || !estimateMoney) return;
    track('first_trip');
    startTransition(async () => {
      const result = await finishOnboarding({
        idempotencyKey,
        homeCity: home?.name ?? '',
        homePoint:
          home && home.latitude !== null && home.longitude !== null
            ? { latitude: home.latitude, longitude: home.longitude }
            : null,
        destination,
        startDate: range.start,
        nights,
        currency: tripCurrency,
        estimate: estimate.trim().replace(',', '.'),
        saved: saved.trim().replace(',', '.') || '0',
        monthly: monthly.trim().replace(',', '.') || '0',
        pipOptIn: pip,
      });
      if (result?.error) setError(t('finishError'));
    });
  };

  const answer = (() => {
    if (!destination || !range || !month || !estimateMoney) return null;
    const plan = livePlan({
      total: estimateMoney,
      saved: savedMoney,
      monthly: monthlyMoney,
      startDate: toLocalDate(range.start),
      today,
    });
    const when = formatYearMonth(month, locale);
    if (plan.status === 'fully-saved')
      return {
        ok: true,
        lead: t('leadYes'),
        rest: t('restAlready', { place: destination.name }),
        plan,
      };
    if (plan.readyMonth === null)
      return { ok: false, lead: t('leadNotYet'), rest: t('restSetMonthly'), plan };
    if (plan.onTime === false)
      return {
        ok: false,
        lead: t('leadNotYet'),
        rest: t('restLate', {
          ready: formatYearMonth(plan.readyMonth, locale),
          needed: plan.monthlyNeeded ? fmt(plan.monthlyNeeded) : fmt(monthlyMoney),
          month: when,
        }),
        plan,
      };
    return {
      ok: true,
      lead: t('leadYes'),
      rest: t('restYes', { place: destination.name, month: when, amount: fmt(monthlyMoney) }),
      plan,
    };
  })();

  // Pip's line on the map for this step, reacting to what was just picked (none on its own intro step, and
  // none on the answer when the person turned Pip off).
  const guide = (() => {
    if (step === 0) return t('guideWelcome');
    if (step === 1) return home?.name ? t('guideHomeSet', { place: home.name }) : t('guideHome');
    if (step === 2)
      return destination ? t('guideDestSet', { place: destination.name }) : t('guideDest');
    if (step === 3) return nights > 0 ? t('guideDatesSet', { count: nights }) : t('guideDates');
    if (step === 4) return t('guideMoney');
    if (step === LAST && pip && answer) return answer.ok ? t('guideYes') : t('guideNotYet');
    return null;
  })();

  const kicker =
    step === 0
      ? t('welcomeKicker')
      : step === LAST
        ? t('answerKicker')
        : t('stepLabel', { step, total: LAST - 1 });

  return (
    <div className={styles.page}>
      <form className={styles.panel} onSubmit={next} noValidate>
        <header className={styles.top}>
          <Link href="/app" className={styles.brand}>
            <span className={styles.brandRing} aria-hidden="true" />
            <span>{SITE_NAME.toLowerCase()}</span>
          </Link>
          <span className={styles.skip}>{t('skipNote')}</span>
        </header>

        <div className={styles.progress} aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} data-on={i <= step || undefined} />
          ))}
        </div>

        <div className={styles.stepBody} ref={content}>
          <div className={styles.question}>
            <span className={styles.kicker}>{kicker}</span>
            <h1 ref={heading} tabIndex={-1}>
              {
                [
                  t('welcomeTitle'),
                  t('originTitle'),
                  t('destTitle'),
                  t('whenTitle'),
                  t('moneyTitle'),
                  t('pipTitle'),
                  t('answerTitle'),
                ][step]
              }
            </h1>
            <p>
              {
                [
                  t('welcomeBody'),
                  t('originBody'),
                  t('destBody'),
                  t('whenBody'),
                  t('moneyBody'),
                  t('pipBody'),
                  t('answerBody'),
                ][step]
              }
            </p>
          </div>

          {step === 0 ? (
            <ul className={styles.promises}>
              {(['promise1', 'promise2', 'promise3'] as const).map((key) => (
                <li key={key}>
                  <span aria-hidden="true">✓</span>
                  {t(key)}
                </li>
              ))}
            </ul>
          ) : null}

          {step === 1 ? (
            <CityPicker
              id="onboarding-home"
              label={t('originLabel')}
              placeholder={t('originPlaceholder')}
              chosen={home}
              onChoose={setHome}
              allowTyped
            />
          ) : null}

          {step === 2 ? (
            <CityPicker
              id="onboarding-destination"
              label={t('destLabel')}
              placeholder={t('destPlaceholder')}
              chosen={destination}
              onChoose={chooseDestination}
              picks
              allowTyped
            />
          ) : null}

          {step === 3 ? (
            <TripDates
              value={range}
              onChange={(next) => {
                setRange(next);
                setError(null);
              }}
            />
          ) : null}

          {step === 4 ? (
            <div className={styles.money}>
              <label className={styles.field}>
                <span>{t('currencyLabel')}</span>
                <select
                  id="onboarding-currency"
                  value={tripCurrency}
                  onChange={(event) => {
                    setTripCurrency(event.target.value);
                    setCurrencyPicked(true);
                  }}
                >
                  {currencyOptions(locale).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>
                  {destination && currencyOfCountry(destination.countryCode) === tripCurrency
                    ? t('currencyFromDestination', { place: destination.name })
                    : t('currencyHint')}
                </small>
              </label>
              <label className={styles.field}>
                <span>{t('estimateLabel')}</span>
                <span className={styles.moneyInput}>
                  <span aria-hidden="true">≈ {tripCurrency}</span>
                  <input
                    id="onboarding-estimate"
                    inputMode="decimal"
                    autoComplete="off"
                    value={estimate}
                    onChange={(event) => {
                      setEstimate(event.target.value);
                      setError(null);
                    }}
                  />
                </span>
                <small>{t('estimateHint')}</small>
              </label>
              <label className={styles.field}>
                <span>{t('savedLabel')}</span>
                <span className={styles.moneyInput}>
                  <span aria-hidden="true">{tripCurrency}</span>
                  <input
                    id="onboarding-saved"
                    inputMode="decimal"
                    autoComplete="off"
                    value={saved}
                    onChange={(event) => setSaved(event.target.value)}
                  />
                </span>
              </label>
              <label className={styles.field}>
                <span>{t('monthlyLabel')}</span>
                <span className={styles.moneyInput}>
                  <span aria-hidden="true">{tripCurrency}</span>
                  <input
                    id="onboarding-monthly"
                    inputMode="decimal"
                    autoComplete="off"
                    value={monthly}
                    onChange={(event) => setMonthly(event.target.value)}
                  />
                </span>
              </label>
            </div>
          ) : null}

          {step === 5 ? (
            <PipIntro destination={destination?.name ?? ''} value={pip} onChange={setPip} />
          ) : null}

          {step === LAST && answer ? (
            <div
              ref={answerCard}
              className={styles.answer}
              data-ok={answer.ok || undefined}
              aria-live="polite"
            >
              <p className={styles.sentence}>
                <span className={styles.lead}>{answer.lead}</span> {answer.rest}
              </p>
              <p className={styles.note}>
                {t('answerSub', {
                  estimate: fmt(estimateMoney!),
                  nights,
                  left: fmt(answer.plan.left),
                  done: answer.plan.left.amountMinor === 0n ? 'yes' : 'no',
                })}
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          {step > 0 ? (
            <button
              type="button"
              className={styles.back}
              onClick={() => {
                setError(null);
                setDirection(-1);
                setStep(step - 1);
              }}
            >
              {t('back')}
            </button>
          ) : null}
          <button type="submit" className={styles.cta} disabled={pending}>
            {pending
              ? t('creating')
              : step === 0
                ? t('start')
                : step === LAST - 1
                  ? t('seeAnswer')
                  : step === LAST
                    ? t('openMap')
                    : t('continue')}
          </button>
        </div>
      </form>

      <aside className={styles.visual} aria-label={t('summary')} data-step={step}>
        {land ? (
          <TripVisual
            land={land}
            home={
              home && home.latitude !== null && home.longitude !== null
                ? { name: home.name, latitude: home.latitude, longitude: home.longitude }
                : null
            }
            destination={
              destination && destination.latitude !== null && destination.longitude !== null
                ? {
                    name: destination.name,
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                  }
                : null
            }
          />
        ) : null}
        {guide ? <TripPip line={guide} cheer={step === LAST && answer?.ok === true} /> : null}
        <div className={styles.summary} data-covers-map>
          <span className={styles.summaryKicker}>{t('yourTrip')}</span>
          <dl>
            <div>
              <dt>{t('from')}</dt>
              <dd>{home?.name || t('none')}</dd>
            </div>
            <div>
              <dt>{t('to')}</dt>
              <dd>{destination?.name ?? t('none')}</dd>
            </div>
            <div>
              <dt>{t('when')}</dt>
              <dd>
                {month && nights > 0
                  ? `${formatYearMonth(month, locale)} · ${t('nightsValue', { count: nights })}`
                  : t('none')}
              </dd>
            </div>
            <div>
              <dt>{t('cost')}</dt>
              <dd>{estimateMoney ? `≈ ${fmt(estimateMoney)}` : t('none')}</dd>
            </div>
            <div>
              <dt>{t('perMonth')}</dt>
              <dd>{step >= 4 ? fmt(monthlyMoney) : t('none')}</dd>
            </div>
            <div>
              <dt>{t('pip')}</dt>
              <dd>{step >= 5 ? (pip ? t('on') : t('off')) : t('none')}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
