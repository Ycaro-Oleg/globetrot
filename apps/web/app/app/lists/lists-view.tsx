'use client';

import { CHECKLIST_GROUPS, MILESTONES, type ChecklistGroup } from '@globetrot/domain';
import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChecklistData, VisaData } from '../../../lib/trips';
import { PipAvatar } from '../_components/pip-avatar';
import { addItem, addSuggestions, removeItem, setItemDone } from './actions';
import { AskPipLink } from '../_components/ask-pip-link';
import styles from './lists.module.css';

type Milestone = (typeof MILESTONES)[number];
type Tab = 'lists' | 'passport';

/** Ring colour of each stamp: decoration only, the stamp's words say what it is. */
const STAMP_INK: Record<Milestone, string> = {
  dest: '#2563EB',
  route: '#0891B2',
  budget: '#059669',
  saved: '#047857',
  docs: '#B45309',
  stays: '#7C3AED',
  itin: '#DB2777',
  check: '#1E293B',
  ready: '#1D4ED8',
};

/** The stamp a list is working towards: documents earn their own, every list together earns "checklist complete". */
const LIST_STAMP: Record<ChecklistGroup, Milestone> = {
  documents: 'docs',
  money: 'check',
  bookings: 'check',
  packing: 'check',
};

/** Milestones that were not earned before and are now. */
export function newlyEarned(
  before: ChecklistData['readiness'],
  after: ChecklistData['readiness'],
): Milestone[] {
  return MILESTONES.filter((key) => !before[key] && after[key]);
}

/**
 * The checklists of the current trip and its passport (design handoff v2, "Lists + Passport"). Lists earn the
 * trip's stamps; when a change earns one, a celebration says so. The passport tab is a booklet: the countries
 * already stamped, the ones on the route still planned, and the nine stamps of this trip.
 */
export function ListsView({
  trip,
  checklist,
  visas,
  routeCountries,
  initialTab,
  pipEnabled = false,
}: {
  pipEnabled?: boolean;
  trip: { id: string; title: string } | null;
  checklist: ChecklistData | null;
  visas: readonly VisaData[];
  routeCountries: readonly string[];
  initialTab: Tab;
}) {
  const t = useTranslations('listsPage');

  if (trip === null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.sub}>{t('noTrip')}</p>
        <Link className={styles.secondary} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }
  if (checklist === null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <Banner tone="error" role="alert">
          {t('loadError')}
        </Banner>
      </section>
    );
  }
  return (
    <Lists
      tripId={trip.id}
      initial={checklist}
      visas={visas}
      routeCountries={routeCountries}
      initialTab={initialTab}
      pipEnabled={pipEnabled}
    />
  );
}

function Lists({
  tripId,
  initial,
  visas,
  routeCountries,
  initialTab,
  pipEnabled,
}: {
  pipEnabled: boolean;
  tripId: string;
  initial: ChecklistData;
  visas: readonly VisaData[];
  routeCountries: readonly string[];
  initialTab: Tab;
}) {
  const t = useTranslations('listsPage');
  const names = useTranslations('milestones');
  const [checklist, setChecklist] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState(false);
  const [celebrating, setCelebrating] = useState<Milestone | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ChecklistGroup, string>>>({});

  /** Applies a change: takes the server's lists and celebrates a stamp the change earned. */
  // The last lists the server confirmed, and the newest change in flight: only its answer is applied, so a slow
  // answer to an older click can never undo a newer one.
  const confirmed = useRef(initial);
  const latest = useRef(0);
  const apply = async (
    change: Promise<ChecklistData | null>,
    optimistic?: (current: ChecklistData) => ChecklistData,
  ) => {
    const id = ++latest.current;
    if (optimistic) setChecklist((current) => optimistic(current));
    const next = await change;
    if (id !== latest.current) return;
    if (!next) {
      setChecklist(confirmed.current);
      setError(true);
      return;
    }
    setError(false);
    const earned = newlyEarned(confirmed.current.readiness, next.readiness);
    confirmed.current = next;
    setChecklist(next);
    if (earned.length) setCelebrating(earned[0]!);
  };

  const pickTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'passport') url.searchParams.set('tab', 'passport');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  };

  const earnedCount = MILESTONES.filter((key) => checklist.readiness[key]).length;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{tab === 'lists' ? t('title') : t('tabPassport')}</h1>
          <span className={styles.sub}>{tab === 'lists' ? t('sub') : t('passportSub')}</span>
        </div>
        {pipEnabled && tab === 'lists' ? <AskPipLink topic="lists" /> : null}
        <div className={styles.tabs} role="tablist" aria-label={t('sections')}>
          {(['lists', 'passport'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              onClick={() => pickTab(key)}
            >
              {key === 'lists' ? t('tabLists') : t('tabPassport')}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <Banner tone="error" role="alert">
          {t('actionError')}
        </Banner>
      ) : null}

      {tab === 'lists' ? (
        <div id="panel-lists" role="tabpanel" aria-labelledby="tab-lists" className={styles.lists}>
          {checklist.items.length === 0 ? (
            <section className={styles.start} aria-labelledby="start-title">
              <h2 id="start-title">{t('startTitle')}</h2>
              <p>{t('startBody')}</p>
              <button
                type="button"
                className={styles.cta}
                onClick={() => void apply(addSuggestions(tripId))}
              >
                {t('startButton')}
              </button>
            </section>
          ) : null}
          {CHECKLIST_GROUPS.map((group) => {
            const items = checklist.items.filter((item) => item.group === group);
            const done = items.filter((item) => item.done).length;
            const name = t(`groups.${group}`);
            const stamp = LIST_STAMP[group];
            const draft = drafts[group] ?? '';
            const add = (event: FormEvent) => {
              event.preventDefault();
              if (!draft.trim()) return;
              setDrafts((current) => ({ ...current, [group]: '' }));
              void apply(addItem(tripId, group, draft));
            };
            return (
              <section key={group} className={styles.list} aria-labelledby={`group-${group}`}>
                <div className={styles.listHead}>
                  <h2 id={`group-${group}`}>{name}</h2>
                  <span>{t('progress', { done, total: items.length })}</span>
                </div>
                <div className={styles.bar} aria-hidden="true">
                  <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
                </div>
                <p className={styles.reward} data-earned={checklist.readiness[stamp] || undefined}>
                  <span aria-hidden="true">★</span>{' '}
                  {checklist.readiness[stamp]
                    ? t('rewardEarned', { stamp: names(stamp) })
                    : t('rewardStamp', { stamp: names(stamp) })}
                </p>
                {items.length === 0 ? (
                  <p className={styles.empty}>{t('emptyGroup')}</p>
                ) : (
                  <ul className={styles.items}>
                    {items.map((item) => (
                      <li key={item.id} data-done={item.done || undefined}>
                        <label>
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() =>
                              void apply(setItemDone(tripId, item.id, !item.done), (current) => ({
                                ...current,
                                items: current.items.map((candidate) =>
                                  candidate.id === item.id
                                    ? { ...candidate, done: !item.done }
                                    : candidate,
                                ),
                              }))
                            }
                          />
                          <span>{item.label}</span>
                        </label>
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={t('removeItem', { label: item.label })}
                          onClick={() => void apply(removeItem(tripId, item.id))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form className={styles.addForm} onSubmit={add}>
                  <input
                    value={draft}
                    maxLength={120}
                    autoComplete="off"
                    placeholder={t('addPlaceholder')}
                    aria-label={t('addLabel', { group: name })}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [group]: event.target.value }))
                    }
                  />
                  <button type="submit" aria-label={t('addLabel', { group: name })}>
                    +
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          id="panel-passport"
          role="tabpanel"
          aria-labelledby="tab-passport"
          className={styles.passport}
        >
          <VisaPages visas={visas} routeCountries={routeCountries} />
          <section className={styles.stampsCard} aria-labelledby="stamps-title">
            <div className={styles.listHead}>
              <h2 id="stamps-title">{t('stampsTitle')}</h2>
              <span>{t('stampsCount', { earned: earnedCount, total: MILESTONES.length })}</span>
            </div>
            <ul className={styles.stamps}>
              {MILESTONES.map((key, index) => {
                const on = checklist.readiness[key];
                return (
                  <li
                    key={key}
                    className={styles.stamp}
                    data-earned={on || undefined}
                    style={{ ['--ink' as string]: STAMP_INK[key] }}
                    aria-label={
                      on
                        ? t('stampEarnedLabel', { name: names(key) })
                        : t('stampLockedLabel', { name: names(key) })
                    }
                  >
                    <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <strong aria-hidden="true">{names(key)}</strong>
                    <span aria-hidden="true">{on ? '✓' : t('stampLocked')}</span>
                  </li>
                );
              })}
            </ul>
            <p className={styles.help}>{t('stampHelp')}</p>
          </section>
        </div>
      )}

      {celebrating ? (
        <Celebration
          name={names(celebrating)}
          number={MILESTONES.indexOf(celebrating) + 1}
          ink={STAMP_INK[celebrating]}
          onClose={() => setCelebrating(null)}
          onPassport={() => {
            setCelebrating(null);
            pickTab('passport');
          }}
        />
      ) : null}
    </section>
  );
}

function VisaPages({
  visas,
  routeCountries,
}: {
  visas: readonly VisaData[];
  routeCountries: readonly string[];
}) {
  const t = useTranslations('listsPage');
  const locale = useLocale();
  const country = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const stamped = new Set(visas.map((visa) => visa.countryCode));
  const planned = routeCountries.filter((code) => !stamped.has(code));

  return (
    <section className={styles.booklet} aria-labelledby="visas-title">
      <span className={styles.bookletKicker}>{t('visaPages')}</span>
      <h2 id="visas-title">{t('visasTitle')}</h2>
      {visas.length === 0 && planned.length === 0 ? (
        <p className={styles.bookletEmpty}>{t('visasEmpty')}</p>
      ) : (
        <ul className={styles.visas}>
          {visas.map((visa) => (
            <li key={visa.countryCode} className={styles.visa}>
              <span className={styles.visaWord}>
                {t('visaWord')} · {visa.countryCode}
              </span>
              <strong>{country(visa.countryCode)}</strong>
              <span>{visa.city}</span>
              <span className={styles.visaStamp} aria-hidden="true">
                <span>{t('entryWord')}</span>
                <b>{visa.countryCode}</b>
                <span>{date.format(new Date(visa.stampedAt)).replace(/\./g, '')}</span>
              </span>
            </li>
          ))}
          {planned.map((code) => (
            <li key={code} className={styles.visa} data-planned="">
              <span className={styles.visaWord}>
                {t('visaWord')} · {code}
              </span>
              <strong>{country(code)}</strong>
              <span>{t('plannedWord')}</span>
              <span className={styles.visaStamp} aria-hidden="true">
                <span>{t('plannedWord')}</span>
                <b>{code}</b>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.bookletNote}>{t('visaNote')}</p>
    </section>
  );
}

function Celebration({
  name,
  number,
  ink,
  onClose,
  onPassport,
}: {
  name: string;
  number: number;
  ink: string;
  onClose: () => void;
  onPassport: () => void;
}) {
  const t = useTranslations('listsPage');
  const locale = useLocale();
  const stamp = useRef<HTMLDivElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const today = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date())
    .replace(/\./g, '');

  useEffect(() => {
    continueButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const reduced =
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && stamp.current?.animate) {
      stamp.current.animate(
        [
          { transform: 'rotate(-30deg) scale(2.4)', opacity: 0 },
          { transform: 'rotate(-6deg) scale(.92)', opacity: 1, offset: 0.55 },
          { transform: 'rotate(-9deg) scale(1.04)', offset: 0.75 },
          { transform: 'rotate(-8deg) scale(1)' },
        ],
        { duration: 700, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'both' },
      );
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.celebration}>
      <div
        className={styles.celebrationDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        aria-describedby="celebration-body"
      >
        <span className={styles.celebrationKicker}>
          {t('celebrationKicker')} · {String(number).padStart(2, '0')}
        </span>
        <div
          ref={stamp}
          className={styles.bigStamp}
          style={{ ['--ink' as string]: ink }}
          aria-hidden="true"
        >
          <span>{String(number).padStart(2, '0')}</span>
          <strong>{name}</strong>
          <span>{today}</span>
        </div>
        <PipAvatar size={104} mood="happy" />
        <h2 id="celebration-title">{t('celebrationTitle')}</h2>
        <p id="celebration-body">{t('celebrationBody', { name })}</p>
        <div className={styles.celebrationActions}>
          <button ref={continueButton} type="button" className={styles.cta} onClick={onClose}>
            {t('continue')}
          </button>
          <button type="button" className={styles.ghost} onClick={onPassport}>
            {t('seePassport')}
          </button>
        </div>
      </div>
    </div>
  );
}
