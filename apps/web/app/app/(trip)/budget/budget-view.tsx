'use client';

import {
  convert,
  exchangeRate,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  formatMoney,
  minorUnitExponent,
  toCurrencyCode,
  fromDecimal,
  money,
  toLocalDate,
  type ExpenseStatus,
  type LocalDate,
  type Money,
} from '@globetrot/domain';
import { formatLocalDate, formatYearMonth, type SupportedLocale } from '@globetrot/i18n';
import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import type { BudgetData, ExpenseData } from '../../../../lib/trips';
import type { Option } from '../../../settings/options';
import { addExpense, removeExpense, saveSavings, type ExpenseInput } from './actions';
import { chartBars, livePlan, parseAmount } from './budget-plan';
import { AskPipLink } from '../../_components/ask-pip-link';
import { GroupMoney, type GroupMoneyData } from './group-money';
import { MilesCard, type MilesData } from './miles-card';
import styles from './budget.module.css';

/** Status glyphs (business rules: a status always shows a glyph and a word, never colour alone). */
export const STATUS_GLYPH: Record<ExpenseStatus, string> = {
  paid: '●',
  confirmed: '✓',
  estimate: '≈',
  unknown: '?',
};
const STATUS_ORDER: readonly ExpenseStatus[] = ['paid', 'confirmed', 'estimate', 'unknown'];
const MONTHLY_MIN = 50;
const MONTHLY_MAX = 2000;
const MONTHLY_STEP = 25;

type Trip = { id: string; title: string; currency: string; startDate: string | null };

function todayLocal(): LocalDate {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return toLocalDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

/**
 * The budget and savings of the current trip (design handoff v2, "Budget"): the answer sentence first, then the
 * numbers. Totals and conversions come from the server; the answer is recomputed live with the domain's savings
 * rule while the monthly amount moves, and every change is saved to the trip.
 */
export function BudgetView({
  trip,
  budget,
  expenses,
  currencies,
  pipEnabled = false,
  group = null,
  miles = null,
}: {
  pipEnabled?: boolean;
  trip: Trip | null;
  budget: BudgetData | null;
  expenses: readonly ExpenseData[];
  currencies: readonly Option[];
  /** Each person's part and the settling up, when the trip is planned together (ADR-0025). */
  group?: GroupMoneyData | null;
  /** The person's miles and the answer counting them (ADR-0030); null hides the card. */
  miles?: MilesData | null;
}) {
  const t = useTranslations('budgetPage');

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
  if (budget === null) {
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
    <Board
      trip={trip}
      budget={budget}
      expenses={expenses}
      currencies={currencies}
      pipEnabled={pipEnabled}
      group={group}
      miles={miles}
    />
  );
}

function Board({
  trip,
  budget,
  expenses,
  currencies,
  pipEnabled,
  group,
  miles,
}: {
  pipEnabled: boolean;
  group: GroupMoneyData | null;
  miles: MilesData | null;
  trip: Trip;
  budget: BudgetData;
  expenses: readonly ExpenseData[];
  currencies: readonly Option[];
}) {
  const t = useTranslations('budgetPage');
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The budget says which currency its amounts are in (the trip's); read them in it.
  const currency = budget.currency;
  const fmt = (value: Money, whole = false) =>
    formatMoney(value, locale, whole ? { precision: 'whole' } : {});
  const view = (value: { amount: string; currency: string }) =>
    fmt(fromDecimal(value.amount, value.currency));

  const total = fromDecimal(budget.total.amount, currency);
  /** What the rough guess still counts for, in words: whole, partly covered by real costs, or covered. */
  const guessNote = (guess: NonNullable<BudgetData['guess']>, hasOthers: boolean) => {
    if (Number(guess.counted.amount) <= 0) return t('guessCovered');
    if (!hasOthers) return t('guessNote');
    return t('guessLeft', { counted: view(guess.counted), amount: view(guess.amount) });
  };
  const [savedText, setSavedText] = useState(plainAmount(budget.savings.saved.amount));
  const [ceilingText, setCeilingText] = useState(plainAmount(budget.savings.ceiling?.amount ?? ''));
  const [monthly, setMonthly] = useState(() => Math.round(Number(budget.savings.monthly.amount)));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [today] = useState(todayLocal);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: ExpenseInput } | null>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  const saved = parseAmount(savedText, currency) ?? money(0n, currency);
  const monthlyMoney = parseAmount(String(monthly), currency) ?? money(0n, currency);
  const ceiling = ceilingText.trim() === '' ? null : parseAmount(ceilingText, currency);
  const startDate = trip.startDate === null ? null : toLocalDate(trip.startDate);
  const plan = livePlan({ total, saved, monthly: monthlyMoney, startDate, today });

  // Save the savings a moment after the person stops changing them.
  const pending = useRef<Parameters<typeof saveSavings>[1] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const queue = (patch: Parameters<typeof saveSavings>[1]) => {
    pending.current = { ...pending.current, ...patch };
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const body = pending.current;
      pending.current = null;
      if (!body) return;
      void saveSavings(trip.id, body).then((result) => {
        setSaveState(result.ok ? 'saved' : 'error');
        if (result.ok) startTransition(() => router.refresh());
      });
    }, 600);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showToast = (next: { text: string; undo?: ExpenseInput }) => setToast(next);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const remove = (expense: ExpenseData) => {
    void removeExpense(trip.id, expense.id).then((result) => {
      if (!result.ok) return showToast({ text: t('actionError') });
      startTransition(() => router.refresh());
      showToast({
        text: t('removed', { description: expense.description }),
        undo: {
          tripId: trip.id,
          description: expense.description,
          category: expense.category,
          status: expense.status,
          amount: expense.original.amount,
          currency: expense.original.currency,
          fxRate: expense.fx?.rate,
        },
      });
    });
  };
  const undo = (input: ExpenseInput) => {
    setToast(null);
    void addExpense(input).then((result) => {
      if (result.ok) startTransition(() => router.refresh());
      else showToast({ text: t('actionError') });
    });
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t('title')}</h1>
          <span className={styles.sub}>
            {trip.title}
            {trip.startDate
              ? ` · ${formatLocalDate(trip.startDate, locale, { dateStyle: 'medium' })}`
              : ''}
          </span>
        </div>
        {pipEnabled ? <AskPipLink topic="budget" /> : null}
        <button
          ref={openButton}
          type="button"
          className={styles.cta}
          onClick={() => setDrawerOpen(true)}
        >
          + {t('addExpense')}
        </button>
      </header>

      <div className={styles.top}>
        <Answer
          plan={plan}
          total={total}
          saved={saved}
          monthly={monthlyMoney}
          today={today}
          startDate={startDate}
          fmt={fmt}
        >
          <div className={styles.controls}>
            <label className={styles.field}>
              <span>{t('savedLabel')}</span>
              <span className={styles.moneyInput}>
                <span aria-hidden="true">{currency}</span>
                <input
                  id="budget-saved"
                  inputMode="decimal"
                  autoComplete="off"
                  value={savedText}
                  onChange={(event) => {
                    setSavedText(event.target.value);
                    const value = parseAmount(event.target.value, currency);
                    if (value) queue({ saved: event.target.value.trim().replace(',', '.') });
                  }}
                />
              </span>
            </label>
            <label className={styles.field}>
              <span>{t('ceilingLabel')}</span>
              <span className={styles.moneyInput}>
                <span aria-hidden="true">{currency}</span>
                <input
                  id="budget-ceiling"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('ceilingPlaceholder')}
                  value={ceilingText}
                  onChange={(event) => {
                    const text = event.target.value;
                    setCeilingText(text);
                    if (text.trim() === '') queue({ ceiling: null });
                    else if (parseAmount(text, currency))
                      queue({ ceiling: text.trim().replace(',', '.') });
                  }}
                />
              </span>
            </label>
            <label className={styles.slider}>
              <span>
                <span>{t('monthlyLabel')}</span>
                <strong>{fmt(monthlyMoney, true)}</strong>
              </span>
              <input
                id="budget-monthly"
                type="range"
                min={MONTHLY_MIN}
                max={Math.max(MONTHLY_MAX, monthly)}
                step={MONTHLY_STEP}
                value={Math.max(MONTHLY_MIN, monthly)}
                aria-valuetext={fmt(monthlyMoney, true)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setMonthly(next);
                  queue({ monthly: String(next) });
                }}
              />
            </label>
            <p className={styles.noMoney}>
              <span role="status" className={styles.saveState}>
                {saveState === 'saving' ? t('saving') : null}
                {saveState === 'saved' ? `✓ ${t('saved')}` : null}
                {saveState === 'error' ? t('savingsError') : null}
              </span>
            </p>
          </div>
        </Answer>

        <Totals budget={budget} total={total} ceiling={ceiling} fmt={fmt} view={view} />
      </div>

      {group ? <GroupMoney tripId={trip.id} group={group} /> : null}
      {miles ? <MilesCard tripId={trip.id} miles={miles} /> : null}

      <section className={styles.card} aria-labelledby="expenses-title">
        <div className={styles.listHead}>
          <h2 id="expenses-title">{t('expensesTitle')}</h2>
          <span>{t('itemsCount', { count: expenses.length })}</span>
        </div>
        {expenses.length === 0 ? (
          <p className={styles.empty}>{t('empty')}</p>
        ) : (
          <ul className={styles.rows}>
            {expenses.map((expense) => (
              <li key={expense.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong>{expense.description}</strong>
                  <span>
                    {t(`categories.${expense.category}`)}
                    {group && expense.paidBy
                      ? ` · ${t('paidByName', {
                          name:
                            group.people.find((person) => person.userId === expense.paidBy)?.name ??
                            '',
                        })}`
                      : ''}
                  </span>
                  {expense.guess && budget.guess ? (
                    <span className={styles.guessNote}>
                      {guessNote(budget.guess, expenses.length > 1)}
                    </span>
                  ) : null}
                </div>
                <span className={styles.chip} data-status={expense.status}>
                  <span className={styles.dot} data-status={expense.status} aria-hidden="true">
                    {STATUS_GLYPH[expense.status]}
                  </span>
                  {t(`statuses.${expense.status}`)}
                </span>
                <span
                  className={styles.original}
                  title={
                    expense.fx
                      ? t('fxNote', {
                          original: view(expense.original),
                          rate: expense.fx.rate,
                          currency,
                          date: formatLocalDate(expense.fx.asOf, locale, { dateStyle: 'medium' }),
                        })
                      : undefined
                  }
                >
                  {expense.fx ? view(expense.original) : ''}
                </span>
                <span className={styles.converted}>
                  {expense.status === 'estimate' ? '≈ ' : ''}
                  {/* The guess shows what it still counts for once real costs came out of it. */}
                  {view(
                    expense.guess && budget.guess ? budget.guess.counted : expense.inTripCurrency,
                  )}
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={t('removeExpense', { description: expense.description })}
                  onClick={() => remove(expense)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.footnote}>{t('rateNote')}</p>
      </section>

      {drawerOpen ? (
        <ExpenseDrawer
          trip={trip}
          people={group?.people ?? null}
          currencies={currencies}
          fmt={fmt}
          onClose={() => {
            setDrawerOpen(false);
            openButton.current?.focus();
          }}
          onAdded={() => {
            setDrawerOpen(false);
            openButton.current?.focus();
            startTransition(() => router.refresh());
            showToast({ text: t('added') });
          }}
        />
      ) : null}

      {toast ? (
        <div className={styles.toast} role="status">
          <span>{toast.text}</span>
          {toast.undo ? (
            <button type="button" onClick={() => undo(toast.undo!)}>
              {t('undo')}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Answer({
  plan,
  total,
  saved,
  monthly,
  today,
  startDate,
  fmt,
  children,
}: {
  plan: ReturnType<typeof livePlan>;
  total: Money;
  saved: Money;
  monthly: Money;
  today: LocalDate;
  startDate: LocalDate | null;
  fmt: (value: Money, whole?: boolean) => string;
  children: React.ReactNode;
}) {
  const t = useTranslations('budgetPage');
  const savingsText = useTranslations('savings');
  const locale = useLocale() as SupportedLocale;
  const month = (value: string) => formatYearMonth(value, locale);
  const departure = startDate
    ? formatLocalDate(startDate, locale, { day: 'numeric', month: 'long' })
    : null;

  let tone: 'ok' | 'late' | 'start' = 'start';
  let lead: string | null = null;
  let rest: string;
  let sub: string | null = null;
  if (plan.status === 'no-costs') {
    rest = savingsText('noCosts');
  } else if (plan.status === 'fully-saved') {
    tone = 'ok';
    lead = t('leadYes');
    rest = t('restAlready');
    sub = t('subExtra', {
      amount: fmt(money(saved.amountMinor - total.amountMinor, total.currency)),
    });
  } else if (plan.readyMonth === null) {
    tone = 'start';
    lead = t('leadNotYet');
    rest = t('restSetMonthly');
  } else if (plan.onTime === false) {
    tone = 'late';
    lead = t('leadNotYet');
    rest = plan.monthlyNeeded
      ? t('restLate', { month: month(plan.readyMonth), needed: fmt(plan.monthlyNeeded, true) })
      : t('restLateNoNeeded', { month: month(plan.readyMonth) });
  } else {
    tone = 'ok';
    lead = t('leadYes');
    rest = t('restYes', { month: month(plan.readyMonth), amount: fmt(monthly, true) });
  }
  if (plan.status === 'saving') {
    sub =
      plan.monthsUntilDeparture !== null && departure
        ? t('subToGo', {
            left: fmt(plan.left, true),
            months: plan.monthsUntilDeparture,
            date: departure,
          })
        : t('subToGoNoDate', { left: fmt(plan.left, true) });
  }

  const bars = chartBars({ total, saved, monthly, today, startDate });
  const highest = bars.reduce(
    (max, bar) => (bar.value.amountMinor > max ? bar.value.amountMinor : max),
    total.amountMinor,
  );
  const scale = (value: bigint) =>
    highest > 0n ? Math.max(3, (Number(value) / Number(highest)) * 89) : 3;
  const shortMonth = (value: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
      .format(new Date(`${value}-15T12:00:00Z`))
      .replace('.', '');

  return (
    <section className={styles.card} aria-labelledby="answer-sentence">
      <div className={styles.answerHead}>
        <span className={styles.kicker}>{t('answerKicker')}</span>
        <span className={styles.pill} data-tone={tone}>
          {tone === 'ok' ? '✓' : tone === 'late' ? '!' : '→'}{' '}
          {tone === 'ok' ? t('pillOk') : tone === 'late' ? t('pillAdjust') : t('pillStart')}
        </span>
      </div>
      <p id="answer-sentence" className={styles.sentence} aria-live="polite">
        {lead ? (
          <span className={styles.lead} data-tone={tone}>
            {lead}
          </span>
        ) : null}{' '}
        {rest}
      </p>
      {sub ? <p className={styles.answerSub}>{sub}</p> : null}

      {plan.status !== 'no-costs' ? (
        <figure className={styles.chart} aria-labelledby="chart-label">
          <figcaption id="chart-label" className="sr-only">
            {t('chartLabel')}
          </figcaption>
          <div className={styles.bars} aria-hidden="true">
            {bars.map((bar) => (
              <div key={bar.month} className={styles.barSlot}>
                {/* The jar each month fills: up to the goal, so the gap reads as what is still to save. */}
                <div
                  className={styles.barGoal}
                  style={{ height: `${scale(total.amountMinor)}%` }}
                />
                {bar.now && !bar.done && total.amountMinor > bar.value.amountMinor ? (
                  <span
                    className={styles.gapLabel}
                    style={{
                      bottom: `calc(${(scale(bar.value.amountMinor) + scale(total.amountMinor)) / 2}% - 8px)`,
                    }}
                  >
                    {t('chartGap', {
                      amount: fmt(
                        money(total.amountMinor - bar.value.amountMinor, total.currency),
                        true,
                      ),
                    })}
                  </span>
                ) : null}
                <div
                  className={styles.bar}
                  data-done={bar.done || undefined}
                  data-now={bar.now || undefined}
                  style={{ height: `${scale(bar.value.amountMinor)}%` }}
                />
                {bar.ready && !bar.departure ? (
                  <span
                    className={styles.readyMark}
                    style={{ bottom: `calc(${scale(bar.value.amountMinor)}% + 6px)` }}
                  >
                    ✓ {t('chartReady')}
                  </span>
                ) : null}
              </div>
            ))}
            <div className={styles.goal} style={{ bottom: `${scale(total.amountMinor)}%` }}>
              <span>{t('chartGoal', { amount: fmt(total, true) })}</span>
            </div>
          </div>
          <div className={styles.barLabels} aria-hidden="true">
            {bars.map((bar) => (
              <span key={bar.month}>
                <strong>
                  {shortMonth(bar.month)}
                  {bar.departure ? ' ✈' : ''}
                </strong>
                <span>
                  {new Intl.NumberFormat(locale, {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(
                    Number(bar.value.amountMinor) / 10 ** minorUnitExponent(total.currency),
                  )}
                </span>
              </span>
            ))}
          </div>
          <ul className="sr-only">
            {bars.map((bar) => (
              <li key={bar.month}>
                {t('chartRow', { month: month(bar.month), amount: fmt(bar.value, true) })}
                {bar.ready ? ` · ${t('chartReady')}` : ''}
                {bar.departure ? ` · ${t('chartDeparts')}` : ''}
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
      {children}
    </section>
  );
}

function Totals({
  budget,
  total,
  ceiling,
  fmt,
  view,
}: {
  budget: BudgetData;
  total: Money;
  ceiling: Money | null;
  fmt: (value: Money, whole?: boolean) => string;
  view: (value: { amount: string; currency: string }) => string;
}) {
  const t = useTranslations('budgetPage');
  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    amount: budget.byStatus.find((entry) => entry.status === status)?.amount ?? {
      amount: '0',
      currency: total.currency,
    },
  }));
  const totalNumber = Number(budget.total.amount);
  const slack =
    ceiling === null ? null : money(ceiling.amountMinor - total.amountMinor, total.currency);

  return (
    <section className={styles.card} aria-labelledby="total-kicker">
      <span id="total-kicker" className={styles.kicker}>
        {t('totalKicker')}
      </span>
      <p className={styles.totalNumber}>{fmt(total)}</p>
      {totalNumber > 0 ? (
        <div className={styles.stack} role="img" aria-label={t('byStatusLabel')}>
          {byStatus
            .filter((entry) => Number(entry.amount.amount) > 0)
            .map((entry) => (
              <span
                key={entry.status}
                data-status={entry.status}
                style={{ width: `${(Number(entry.amount.amount) / totalNumber) * 100}%` }}
              />
            ))}
        </div>
      ) : null}
      <ul className={styles.legend} aria-label={t('byStatusLabel')}>
        {byStatus.map((entry) => (
          <li key={entry.status}>
            <span className={styles.dot} data-status={entry.status} aria-hidden="true">
              {STATUS_GLYPH[entry.status]}
            </span>
            <span>{t(`statuses.${entry.status}`)}</span>
            <strong>{view(entry.amount)}</strong>
          </li>
        ))}
      </ul>
      <p
        className={styles.slack}
        data-tone={slack === null ? 'none' : slack.amountMinor < 0n ? 'over' : 'ok'}
      >
        {slack === null
          ? t('slackNone')
          : slack.amountMinor < 0n
            ? `▲ ${t('slackOver', { amount: fmt(money(-slack.amountMinor, slack.currency), true) })}`
            : `✓ ${t('slackOk', { amount: fmt(slack, true) })}`}
      </p>
      <p className={styles.footnote}>{t('estNote')}</p>
    </section>
  );
}

function ExpenseDrawer({
  trip,
  people,
  currencies,
  fmt,
  onClose,
  onAdded,
}: {
  trip: Trip;
  /** Who can have paid, on a trip planned together; null otherwise. */
  people: GroupMoneyData['people'] | null;
  currencies: readonly Option[];
  fmt: (value: Money, whole?: boolean) => string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations('budgetPage');
  const titleId = useId();
  const first = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(trip.currency);
  const [fxRate, setFxRate] = useState('');
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>('food');
  const [status, setStatus] = useState<ExpenseStatus>('estimate');
  const [paidBy, setPaidBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const foreign = currency !== trip.currency;
  const typed = parseAmount(amount, currency);
  const rateText = fxRate.trim().replace(',', '.');
  const rate = Number(rateText);
  const preview = (() => {
    if (!typed || !foreign || !(rate > 0)) return null;
    try {
      const converted = convert(
        typed,
        exchangeRate({
          id: 'preview',
          base: currency,
          quote: toCurrencyCode(trip.currency),
          rate: rateText,
          source: 'typed',
          asOf: new Date(),
        }),
      );
      return fmt(converted.converted);
    } catch {
      return null;
    }
  })();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim() || !typed || typed.amountMinor <= 0n) {
      setError(t('formError'));
      return;
    }
    if (foreign && !(rate > 0)) {
      setError(t('rateRequired', { currency: trip.currency }));
      return;
    }
    setBusy(true);
    void addExpense({
      tripId: trip.id,
      description,
      category,
      status,
      amount: amount.trim().replace(',', '.'),
      currency,
      fxRate: foreign ? fxRate.trim().replace(',', '.') : undefined,
      paidBy: paidBy || null,
    }).then((result) => {
      setBusy(false);
      if (result.ok) onAdded();
      else setError(t('expenseError'));
    });
  };

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <form
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
      >
        <div className={styles.drawerHead}>
          <h2 id={titleId}>{t('addExpense')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        </div>
        <label className={styles.field}>
          <span>{t('description')}</span>
          <input
            ref={first}
            id="expense-description"
            value={description}
            maxLength={120}
            autoComplete="off"
            placeholder={t('descPlaceholder')}
            onChange={(event) => {
              setDescription(event.target.value);
              setError(null);
            }}
          />
        </label>
        <div className={styles.amountRow}>
          <label className={styles.field}>
            <span>{t('amount')}</span>
            <input
              id="expense-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
            />
          </label>
          <label className={styles.field}>
            <span>{t('currency')}</span>
            <select
              id="expense-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {currencies.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {foreign ? (
          <label className={styles.field}>
            <span>{t('fxRate', { currency: trip.currency })}</span>
            <input
              id="expense-rate"
              inputMode="decimal"
              autoComplete="off"
              value={fxRate}
              onChange={(event) => {
                setFxRate(event.target.value);
                setError(null);
              }}
            />
            <small>
              {preview
                ? t('preview', { amount: preview })
                : t('fxHelp', { currency: trip.currency })}
            </small>
          </label>
        ) : null}
        {people ? (
          <label className={styles.field}>
            <span>{t('paidBy')}</span>
            <select
              id="expense-paid-by"
              value={paidBy}
              onChange={(event) => setPaidBy(event.target.value)}
            >
              <option value="">{t('paidByNobody')}</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <fieldset className={styles.choices}>
          <legend>{t('category')}</legend>
          <div className={styles.chips}>
            {EXPENSE_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {t(`categories.${value}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.choices}>
          <legend>{t('status')}</legend>
          <div className={styles.statuses}>
            {EXPENSE_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                <span className={styles.dot} data-status={value} aria-hidden="true">
                  {STATUS_GLYPH[value]}
                </span>
                {t(`statuses.${value}`)}
              </button>
            ))}
          </div>
          <small>{t(`statusHelp.${status}`)}</small>
        </fieldset>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.submit} disabled={busy}>
          {t('submit')}
        </button>
      </form>
    </>
  );
}

/** "1200.00" → "1200", "12.50" → "12.5": an amount as a person types it, for the fields. */
function plainAmount(amount: string): string {
  return amount.includes('.') ? amount.replace(/0+$/, '').replace(/\.$/, '') : amount;
}
