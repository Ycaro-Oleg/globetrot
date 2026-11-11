'use client';

import { formatMoney, fromDecimal } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './landing-widgets.module.css';

type Place = { id: string; label: string; x: number; y: number };
const places: Place[] = [
  { id: 'new-york', label: 'placeNewYork', x: 28, y: 39 },
  { id: 'rio', label: 'placeRio', x: 36, y: 65 },
  { id: 'buenos-aires', label: 'placeBuenosAires', x: 39, y: 74 },
  { id: 'lisbon', label: 'placeLisbon', x: 50, y: 43 },
  { id: 'paris', label: 'placeParis', x: 52, y: 39 },
  { id: 'cape-town', label: 'placeCapeTown', x: 56, y: 75 },
  { id: 'tokyo', label: 'placeTokyo', x: 83, y: 43 },
  { id: 'sydney', label: 'placeSydney', x: 90, y: 74 },
];

function pathFor(ids: string[]) {
  const selected = ids
    .map((id) => places.find((place) => place.id === id))
    .filter((p): p is Place => Boolean(p));
  if (selected.length < 2) return '';
  return selected
    .map((place, index) => {
      const x = place.x * 10;
      const y = place.y * 5;
      if (index === 0) return `M ${x} ${y}`;
      const previous = selected[index - 1]!;
      const px = previous.x * 10;
      const py = previous.y * 5;
      const mx = (px + x) / 2;
      const my = (py + y) / 2 - Math.min(50, Math.abs(x - px) * 0.08);
      return ` Q ${mx} ${my} ${x} ${y}`;
    })
    .join('');
}

export function ThemeToggle() {
  const t = useTranslations('landing');
  const [night, setNight] = useState(false);
  return (
    <button
      className={styles.themeToggle}
      type="button"
      aria-label={night ? t('themeDay') : t('themeNight')}
      title={night ? t('themeDay') : t('themeNight')}
      onClick={() => {
        const next = !night;
        setNight(next);
        document.querySelector('[data-landing]')?.setAttribute('data-night', String(next));
      }}
    >
      {night ? '☀' : '☾'}
    </button>
  );
}

export function HeroMap() {
  const t = useTranslations('landing');
  const [route, setRoute] = useState<string[]>(['lisbon', 'tokyo']);
  const [active, setActive] = useState<string | null>(null);
  const path = useMemo(() => pathFor(route), [route]);
  const toggle = (id: string) =>
    setRoute((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <section className={styles.heroMap} id="board" aria-label={t('mapAria')}>
      <img className={styles.worldImage} src="/world-map-wide.svg" alt="" />
      <svg
        className={styles.mapRoutes}
        viewBox="0 0 1000 500"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {path ? <path d={path} className={styles.mapRouteShadow} /> : null}
        {path ? <path d={path} className={styles.mapRoute} /> : null}
      </svg>
      {places.map((place) => {
        const selected = route.includes(place.id);
        return (
          <button
            className={`${styles.mapPin} ${selected ? styles.mapPinSelected : ''} ${active === place.id ? styles.mapPinActive : ''}`}
            key={place.id}
            type="button"
            style={{ left: `${place.x}%`, top: `${place.y}%` }}
            aria-pressed={selected}
            aria-label={t('mapPinAction', {
              place: t(place.label),
              action: selected ? t('mapRemove') : t('mapAdd'),
            })}
            onClick={() => {
              setActive(place.id);
              toggle(place.id);
            }}
          >
            <span className={styles.pinDot} />
            <span className={styles.pinLabel}>{t(place.label)}</span>
          </button>
        );
      })}
      <div className={styles.mapTry}>
        <span className={styles.eyebrow}>{t('mapTry')}</span>
        <strong aria-live="polite">{t('mapConnected', { count: route.length })}</strong>
        <span>{active ? t(places.find((p) => p.id === active)!.label) : t('mapHint')}</span>
      </div>
      <div className={styles.mapTools} aria-label={t('mapLegend')}>
        <span>
          <i className={styles.legendRoute} />
          {t('mapLegendRoute')}
        </span>
        <span>
          <i className={styles.legendPin} />
          {t('mapLegendPin')}
        </span>
      </div>
      <button
        className={styles.mapReset}
        type="button"
        onClick={() => {
          setRoute([]);
          setActive(null);
        }}
      >
        {t('mapReset')}
      </button>
    </section>
  );
}

export function StoryMap() {
  const t = useTranslations('landing');
  const [active, setActive] = useState(1);
  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-story-step]')];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - innerHeight * 0.5) -
              Math.abs(b.boundingClientRect.top - innerHeight * 0.5),
          )[0];
        const step = visible?.target.getAttribute('data-story-step');
        if (step) setActive(Number(step));
      },
      { rootMargin: '-25% 0px -35% 0px', threshold: 0.1 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.storyGrid}>
      <div className={styles.storyMapSticky}>
        <img className={styles.worldImage} src="/world-map-wide.svg" alt="" />
        <svg
          className={styles.mapRoutes}
          viewBox="0 0 1000 500"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={pathFor(['tokyo', 'kyoto', 'osaka'])} className={styles.mapRouteShadow} />
          <path d={pathFor(['tokyo', 'kyoto', 'osaka'])} className={styles.mapRoute} />
        </svg>
        {places
          .filter((p) => ['tokyo', 'lisbon', 'kyoto', 'osaka'].includes(p.id))
          .map((place) => (
            <span
              key={place.id}
              className={`${styles.storyPin} ${active >= 2 && ['kyoto', 'osaka'].includes(place.id) ? styles.storyPinOn : ''}`}
              style={{ left: `${place.x}%`, top: `${place.y}%` }}
              aria-hidden="true"
            />
          ))}
        <div className={styles.storyPostcard}>
          <span>{t(`step${Math.min(active, 4)}Title`)}</span>
          <strong>{t('storyMapTitle')}</strong>
          <small>{t('storyMapMeta')}</small>
        </div>
        {active >= 4 ? <div className={styles.storyNote}>{t('storyNote')}</div> : null}
        <span className={styles.storyActive} aria-live="polite">
          {t('storyStepProgress', { step: active })}
        </span>
      </div>
      <div className={styles.storySteps}>
        {[1, 2, 3, 4].map((step) => (
          <article
            className={`${styles.storyStep} ${active === step ? styles.storyStepActive : ''}`}
            data-story-step={step}
            key={step}
          >
            <span className={styles.stepNumber}>{['i', 'ii', 'iii', 'iv'][step - 1]}</span>
            <div>
              <h3>{t(`step${step}Title`)}</h3>
              <p>{t(`step${step}Body`)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Whole US dollars, formatted for the page's language (USD is the default currency; examples never use another). */
function useUsd() {
  const locale = useLocale();
  return (whole: number) =>
    formatMoney(fromDecimal(String(whole), 'USD'), locale, { precision: 'whole' });
}

const changeCosts = [900, 1400, 260, 380, 0];
export function PipPlanner() {
  const t = useTranslations('landing');
  const usd = useUsd();
  const [kept, setKept] = useState([true, true, true, true, false]);
  const total = kept.reduce(
    (sum, selected, index) => sum + (selected ? changeCosts[index]! : 0),
    0,
  );
  const items = [1, 2, 3, 4, 5];

  return (
    <div className={styles.pipGrid}>
      <div className={styles.pipStory}>
        <span className={styles.eyebrow}>{t('pipEyebrow')}</span>
        <h2>{t.rich('pipTitle', { accent: (chunks) => <em>{chunks}</em> })}</h2>
        <p>{t('pipBody')}</p>
        <div className={styles.pipMascot} aria-hidden="true">
          <svg viewBox="0 0 160 150">
            <ellipse cx="72" cy="143" rx="40" ry="5" />
            <path className={styles.mascotCase} d="M107 104h31v27h-31z" />
            <circle className={styles.mascotGlobe} cx="70" cy="82" r="41" />
            <path
              className={styles.mascotContinent}
              d="M42 68q18-13 26 0t-5 17q-13 10-21-1zM82 91q17-12 21 0t-11 16q-13-1-10-16z"
            />
            <ellipse className={styles.mascotEye} cx="59" cy="80" rx="6" ry="8" />
            <ellipse className={styles.mascotEye} cx="82" cy="80" rx="6" ry="8" />
            <path className={styles.mascotMouth} d="M61 96q9 8 17 0" />
            <path className={styles.mascotHat} d="M30 47q38-13 80 0v-9q-3-22-40-22T30 38z" />
            <path className={styles.mascotHatBand} d="M43 39q28 8 55 0" />
            <path className={styles.mascotLeg} d="m57 120-3 17m29-17 3 17m-39 1h12m25 0h12" />
          </svg>
        </div>
        <div className={styles.poseRow}>
          {['idle', 'research', 'draft', 'deliver', 'celebrate'].map((pose, index) => (
            <span key={pose}>
              <i className={`${styles.poseDot} ${index === 2 ? styles.poseDotOn : ''}`} />
              {t(`pose${index + 1}`)}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.pipDemo}>
        <span className={styles.eyebrow}>{t('pipPromptLabel')}</span>
        <blockquote>{t('pipPrompt', { budget: usd(3000) })}</blockquote>
        <div className={styles.pipListHeading}>
          <strong>{t('pipChanges')}</strong>
          <span>{t('estimateDisclaimer')}</span>
        </div>
        <div className={styles.pipChanges}>
          {items.map((item, index) => (
            <label className={styles.pipChange} key={item}>
              <input
                type="checkbox"
                checked={kept[index]}
                onChange={() =>
                  setKept((current) => current.map((value, i) => (i === index ? !value : value)))
                }
              />
              <span className={styles.pipCheck} aria-hidden="true" />
              <span className={styles.pipChangeCopy}>
                <strong>{t(`pipChange${item}`)}</strong>
                <small>{t(`pipDetail${item}`)}</small>
              </span>
              <b>{item === 5 ? t('unknownAmount') : usd(changeCosts[index]!)}</b>
            </label>
          ))}
        </div>
        <div className={styles.pipTotal}>
          <span>{t('pipKeptTotal')}</span>
          <strong>{usd(total)}</strong>
          <Link href="/signup">{t('pipApply')}</Link>
        </div>
        <p className={styles.visaHint}>{t('visaNote')}</p>
      </div>
    </div>
  );
}

export function MoneyPlanner() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const usd = useUsd();
  const [monthly, setMonthly] = useState(300);
  const total = 2860;
  const saved = 1280;
  const months = Math.ceil((total - saved) / monthly);
  const readyDate = new Date(Date.UTC(2026, 10 + months, 1));
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(readyDate);
  const money = { format: usd };
  const progress = Math.min(100, ((saved + monthly * months) / total) * 100);

  return (
    <div className={styles.moneyGrid}>
      <div className={styles.moneyCopy}>
        <span className={styles.eyebrow}>{t('moneyEyebrow')}</span>
        <h2>{t.rich('moneyTitle', { accent: (chunks) => <em>{chunks}</em> })}</h2>
        <p>{t('moneyBody')}</p>
      </div>
      <div className={styles.moneyCard}>
        <p className={styles.moneyAnswer} aria-live="polite">
          {t('moneyAnswer', { month: monthLabel, amount: money.format(monthly) })}
        </p>
        <label className={styles.moneyRange}>
          <span>
            {t('moneyMonthly')} <strong>{money.format(monthly)}</strong>
          </span>
          <input
            type="range"
            min="100"
            max="600"
            step="10"
            value={monthly}
            onChange={(event) => setMonthly(Number(event.target.value))}
          />
        </label>
        <div
          className={styles.progressLine}
          aria-label={t('moneyProgress', { progress: Math.round(progress) })}
        >
          <svg viewBox="0 0 600 140" role="img" aria-hidden="true">
            <path className={styles.progressGrid} d="M0 20H600M0 70H600M0 120H600" />
            <path
              className={styles.progressCurveBg}
              d="M0 120C100 116 140 100 220 96S350 45 410 48S500 8 600 10"
            />
            <path
              className={styles.progressCurve}
              d={`M0 120C100 116 140 100 220 96S350 45 410 48S${Math.max(460, progress * 5)} ${Math.max(25, 120 - progress)} 600 10`}
            />
          </svg>
          <div>
            <span>{t('moneySaved', { amount: money.format(saved) })}</span>
            <span>{t('moneyTotal', { amount: money.format(total) })}</span>
          </div>
        </div>
        <div className={styles.moneyMarks}>
          <span>{t('markEstimate')}</span>
          <span>{t('markConfirmed')}</span>
          <span>{t('markPaid')}</span>
          <span>{t('markUnknown')}</span>
        </div>
        <p className={styles.moneyFootnote}>
          {t('moneyExample', { total: usd(total), saved: usd(saved) })}
        </p>
      </div>
    </div>
  );
}
