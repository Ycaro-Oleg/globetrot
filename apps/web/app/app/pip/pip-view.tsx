'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { PipAvatar } from '../_components/pip-avatar';
import { askPip, decide, type ProposalData } from './actions';
import styles from './pip.module.css';

type Change = ProposalData['changes'][number];

const SUGGESTIONS = ['slower', 'places', 'packing', 'costs'] as const;
const GLYPH: Record<ProposalData['status'], string> = {
  proposed: '✎',
  applied: '✓',
  discarded: '×',
  undone: '↺',
};

/**
 * Pip (business rules, "AI (Pip)"): the person asks in their own words, Pip answers a change list, nothing changes
 * until they tick what they want and apply it, and "Undo" puts the trip back. The page says what is sent to the
 * model and that amounts are estimates.
 */
export function PipView({
  trip,
  stops,
  initial,
  idea = null,
  credits = null,
}: {
  trip: { id: string; title: string; currency: string } | null;
  stops: readonly { id: string; name: string }[];
  initial: readonly ProposalData[];
  /** An idea that fits the screen the person came from, written into the box (not sent). */
  idea?: (typeof SUGGESTIONS)[number] | null;
  /** Pip credits left (monthly plus bought), or null when unknown. */
  credits?: number | null;
}) {
  const t = useTranslations('pipPage');
  const locale = useLocale();
  const id = useId();
  const [request, setRequest] = useState(() => (idea ? t(`suggestions.${idea}`) : ''));
  const [proposals, setProposals] = useState<ProposalData[]>([...initial]);
  const [current, setCurrent] = useState<ProposalData | null>(
    initial[0]?.status === 'proposed' ? initial[0] : null,
  );
  const [picked, setPicked] = useState<ReadonlySet<number>>(
    new Set(current?.changes.map((_, index) => index) ?? []),
  );
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [planNeeded, setPlanNeeded] = useState(false);
  const [left, setLeft] = useState(credits);
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const names = new Map(stops.map((stop) => [stop.id, stop.name]));
  const stopName = (stopId: string | null) =>
    stopId === null ? t('noDay') : (names.get(stopId) ?? t('newStop'));
  const money = (amount: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: trip?.currency ?? 'USD' }).format(
      Number(amount),
    );

  useEffect(
    () => () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    },
    [],
  );

  if (!trip) {
    return (
      <section className={styles.page}>
        <div className={styles.empty}>
          <PipAvatar size={120} />
          <h1>{t('title')}</h1>
          <p>{t('noTrip')}</p>
          <Link href="/app/trips" className={styles.primary}>
            {t('openTrips')}
          </Link>
        </div>
      </section>
    );
  }

  function remember(next: ProposalData) {
    setProposals((list) => [next, ...list.filter((p) => p.id !== next.id)]);
  }

  function ask(event?: FormEvent, text = request) {
    event?.preventDefault();
    if (!text.trim() || !trip) return;
    setError(null);
    setPlanNeeded(false);
    setStatus(t('steps.read'));
    setStep(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => setStep((s) => Math.min(2, s + 1)), 2500);
    startTransition(async () => {
      const result = await askPip(trip.id, text);
      if (stepTimer.current) clearInterval(stepTimer.current);
      if ('error' in result) {
        setStatus('');
        setPlanNeeded(result.error === 'OUT_OF_CREDITS' || result.error === 'PLAN_REQUIRED');
        if (result.error === 'OUT_OF_CREDITS') setLeft(0);
        return setError(t(`errors.${result.error}`));
      }
      setLeft((value) => (value === null ? null : Math.max(0, value - 1)));
      remember(result);
      setCurrent(result);
      setPicked(new Set(result.changes.map((_, index) => index)));
      setStatus(t('ready', { count: result.changes.length }));
    });
  }

  function act(proposal: ProposalData, action: 'apply' | 'discard' | 'undo') {
    startTransition(async () => {
      const next = await decide(
        proposal.id,
        action,
        [...picked].sort((a, b) => a - b),
      );
      if (!next) return setError(t('errors.UNKNOWN'));
      remember(next);
      setCurrent(next.status === 'proposed' ? next : action === 'apply' ? next : null);
      setStatus(
        action === 'apply'
          ? t('applied', { count: next.applied.length })
          : action === 'undo'
            ? t('undone')
            : t('discarded'),
      );
    });
  }

  function label(change: Change): string {
    switch (change.kind) {
      case 'addStop':
        return t('change.addStop', { name: change.name, nights: change.nights });
      case 'removeStop':
        return t('change.removeStop', { stop: stopName(change.stopId) });
      case 'setNights':
        return t('change.setNights', { stop: stopName(change.stopId), nights: change.nights });
      case 'reorder':
        return t('change.reorder', { order: change.order.map(stopName).join(' → ') });
      case 'addPlace':
        return t('change.addPlace', { name: change.name, stop: stopName(change.stopId) });
      case 'addSpot':
        return t('change.addSpot', { name: change.name, stop: stopName(change.stopId) });
      case 'addChecklistItem':
        return t('change.addChecklistItem', {
          group: t(`groups.${change.group}`),
          label: change.label,
        });
      case 'addExpense':
        return t('change.addExpense', { description: change.description });
      case 'setMonthly':
        return t('change.setMonthly', { amount: money(change.amount) });
    }
  }

  const deciding = current?.status === 'proposed';
  const history = proposals.filter((p) => p.id !== current?.id);

  return (
    <section className={styles.page} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <PipAvatar
          size={88}
          pose={
            pending
              ? step === 0
                ? 'research'
                : 'draft'
              : error
                ? 'unsure'
                : current
                  ? 'deliver'
                  : 'idle'
          }
        />
        <div>
          <p className={styles.eyebrow}>{t('eyebrow', { trip: trip.title })}</p>
          <h1 id={`${id}-title`}>{t('title')}</h1>
          <p className={styles.lead}>{t('lead')}</p>
        </div>
      </header>

      <form className={styles.ask} onSubmit={ask}>
        <label htmlFor={`${id}-request`}>{t('askLabel')}</label>
        <textarea
          id={`${id}-request`}
          value={request}
          rows={3}
          maxLength={500}
          placeholder={t('placeholder')}
          onChange={(event) => setRequest(event.target.value)}
        />
        <div className={styles.suggestions} role="group" aria-label={t('suggestionsLabel')}>
          {SUGGESTIONS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => {
                const text = t(`suggestions.${key}`);
                setRequest(text);
                ask(undefined, text);
              }}
            >
              {t(`suggestions.${key}`)}
            </button>
          ))}
        </div>
        <div className={styles.row}>
          <p className={styles.note}>
            {t('privacy')}
            {left !== null ? (
              <>
                {' '}
                <Link href="/app/plan" className={styles.credits}>
                  {t('creditsLeft', { count: left })}
                </Link>
              </>
            ) : null}
          </p>
          <button type="submit" className={styles.cta} disabled={pending || !request.trim()}>
            {pending ? t('asking') : t('ask')}
          </button>
        </div>
      </form>

      <p className={styles.status} role="status" aria-live="polite">
        {status}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
          {planNeeded ? (
            <>
              {' '}
              <Link href="/app/plan">{t('seePlans')}</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {pending && !current ? (
        <ol className={styles.steps} aria-hidden="true">
          {(['read', 'draft', 'check'] as const).map((key, index) => (
            <li key={key} data-state={index < step ? 'done' : index === step ? 'now' : 'next'}>
              {t(`steps.${key}`)}
            </li>
          ))}
        </ol>
      ) : null}

      {current ? (
        <section className={styles.proposal} aria-labelledby={`${id}-proposal`}>
          <p className={styles.you}>
            <span>{t('youAsked')}</span> “{current.request}”
          </p>
          <h2 id={`${id}-proposal`}>{current.summary || t('noSummary')}</h2>
          {current.changes.length === 0 ? (
            <p className={styles.muted}>{t('noChanges')}</p>
          ) : (
            <ul className={styles.changes}>
              {current.changes.map((change, index) => {
                const on = deciding ? picked.has(index) : current.applied.includes(index);
                return (
                  <li key={index} data-on={on || undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!deciding || pending}
                        onChange={() =>
                          setPicked((set) => {
                            const next = new Set(set);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                      />
                      <span>
                        <strong>{label(change)}</strong>
                        {change.reason ? <small>{change.reason}</small> : null}
                      </span>
                      {change.kind === 'addExpense' ? (
                        <span className={styles.estimate}>
                          <span aria-hidden="true">≈ </span>
                          {money(change.amount)} · {t('estimate')}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.note}>{t('disclaimer')}</p>
          {deciding ? (
            <div className={styles.row}>
              <button
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() => act(current, 'discard')}
              >
                {t('discard')}
              </button>
              <button
                type="button"
                className={styles.cta}
                disabled={pending || picked.size === 0}
                onClick={() => act(current, 'apply')}
              >
                {t('apply', { count: picked.size })}
              </button>
            </div>
          ) : current.status === 'applied' ? (
            <div className={styles.row}>
              <p className={styles.done}>
                <span aria-hidden="true">✓ </span>
                {t('applied', { count: current.applied.length })}
              </p>
              {current.undoable ? (
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => act(current, 'undo')}
                >
                  {t('undo')}
                </button>
              ) : null}
              <Link href="/app/board" className={styles.textLink}>
                {t('seeMap')}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className={styles.history} aria-labelledby={`${id}-history`}>
          <h2 id={`${id}-history`}>{t('history')}</h2>
          <ul>
            {history.map((proposal) => (
              <li key={proposal.id}>
                <span className={styles.chip}>
                  <span aria-hidden="true">{GLYPH[proposal.status]} </span>
                  {t(`statuses.${proposal.status}`)}
                </span>
                <span className={styles.historyText}>“{proposal.request}”</span>
                <time dateTime={proposal.createdAt}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(proposal.createdAt))}
                </time>
                {proposal.undoable ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => act(proposal, 'undo')}
                  >
                    {t('undo')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
