'use client';

import { formatMoney, fromDecimal, type ChecklistGroup } from '@globetrot/domain';
import type { SupportedLocale } from '@globetrot/i18n';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { track } from '../../../lib/analytics';
import { addPhaseTask, checkIn } from './actions';
import { NO_PARTNERS, type Partners } from '../../../lib/partners';
import styles from './today.module.css';

type Amount = { amount: string; currency: string };

export interface HabitData {
  readonly week: string;
  readonly checkedIn: Amount | null;
  readonly streak: number;
  readonly suggested: Amount;
  readonly countdown: {
    readonly daysLeft: number | null;
    readonly phase:
      'six-months' | 'three-months' | 'one-month' | 'one-week' | 'travelling' | 'back' | null;
    readonly tasks: readonly string[];
  };
}

/** Which checklist a phase's suggestion goes to; suggestions without one are reminders only. */
const TASK_GROUP: Readonly<Record<string, ChecklistGroup>> = {
  passport: 'documents',
  entryRules: 'documents',
  insurance: 'documents',
  vaccines: 'documents',
  documents: 'documents',
  flights: 'bookings',
  stays: 'bookings',
  transfers: 'bookings',
  esim: 'packing',
  packing: 'packing',
  offline: 'packing',
  cards: 'money',
};

const plain = (amount: string) => amount.replace(/\.00$/, '');

export function TodayView({
  trip,
  habit,
  partners = NO_PARTNERS,
}: {
  trip: { id: string; title: string; canEdit: boolean } | null;
  habit: HabitData | null;
  /** Insurance and eSIM partner pages, offered next to those suggestions when configured (ADR-0031). */
  partners?: Partners;
}) {
  const t = useTranslations('todayPage');
  const locale = useLocale() as SupportedLocale;
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(
    plain(
      habit?.checkedIn?.amount ??
        (habit && Number(habit.suggested.amount) > 0 ? habit.suggested.amount : ''),
    ),
  );
  const [status, setStatus] = useState('');
  const [added, setAdded] = useState<readonly string[]>([]);

  if (!trip || !habit) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.sub}>{trip ? t('loadError') : t('noTrip')}</p>
        <Link className={styles.secondary} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }

  const fmt = (value: Amount) =>
    formatMoney(fromDecimal(value.amount, value.currency), locale, { precision: 'whole' });
  const { daysLeft, phase, tasks } = habit.countdown;

  const save = () =>
    startTransition(async () => {
      const ok = await checkIn(trip.id, amount || '0');
      setStatus(ok ? t('checkedIn') : t('checkInError'));
      if (ok) {
        track('savings_checkin');
        router.refresh();
      }
    });
  const add = (task: string) =>
    startTransition(async () => {
      const group = TASK_GROUP[task];
      if (!group) return;
      const ok = await addPhaseTask(trip.id, group, t(`tasks.${task}`));
      if (ok) setAdded((current) => [...current, task]);
      setStatus(ok ? t('taskAdded', { task: t(`tasks.${task}`) }) : t('checkInError'));
    });

  return (
    <section className={styles.page} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{trip.title}</p>
        <h1 id={`${id}-title`} className={styles.title}>
          {phase === null
            ? t('noDate')
            : phase === 'travelling'
              ? t('travelling')
              : phase === 'back'
                ? t('back')
                : t('daysLeft', { count: daysLeft ?? 0 })}
        </h1>
        {phase === null ? (
          <Link className={styles.secondary} href={`/app/trips/${trip.id}`}>
            {t('setDate')}
          </Link>
        ) : null}
      </header>

      <section className={styles.card} aria-labelledby={`${id}-week`}>
        <h2 id={`${id}-week`}>{t('weekTitle')}</h2>
        <p className={styles.streak}>
          {habit.streak > 0 ? t('streak', { count: habit.streak }) : t('streakStart')}
        </p>
        {habit.checkedIn ? (
          <p className={styles.done}>
            <span aria-hidden="true">✓ </span>
            {t('doneThisWeek', { amount: fmt(habit.checkedIn) })}
          </p>
        ) : null}
        <div className={styles.checkin}>
          <label className={styles.field}>
            <span>{t('amountLabel')}</span>
            <span className={styles.moneyInput}>
              <span aria-hidden="true">{habit.suggested.currency}</span>
              <input
                id={`${id}-amount`}
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </span>
          </label>
          <button type="button" className={styles.cta} disabled={pending} onClick={save}>
            {habit.checkedIn ? t('changeCheckIn') : t('checkIn')}
          </button>
        </div>
        <p className={styles.hint}>{t('checkInHint')}</p>
      </section>

      {phase ? (
        <section className={styles.card} aria-labelledby={`${id}-phase`}>
          <h2 id={`${id}-phase`}>{t(`phase.${phase}`)}</h2>
          <ul className={styles.tasks}>
            {tasks.map((task) => (
              <li key={task}>
                <span>
                  {t(`tasks.${task}`)}
                  {(task === 'insurance' && partners.insurance) ||
                  (task === 'esim' && partners.esim) ? (
                    <>
                      {' '}
                      <a
                        className={styles.partner}
                        href={(task === 'insurance' ? partners.insurance : partners.esim)!}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                      >
                        {t('partnerLink')}
                      </a>
                    </>
                  ) : null}
                </span>
                {TASK_GROUP[task] && trip.canEdit ? (
                  added.includes(task) ? (
                    <span className={styles.added}>{t('added')}</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={pending}
                      onClick={() => add(task)}
                    >
                      {t('addToChecklist')}
                      <span className="sr-only">: {t(`tasks.${task}`)}</span>
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
          {phase === 'travelling' ? (
            <div className={styles.links}>
              <Link className={styles.secondary} href="/app/days">
                {t('todayPlan')}
              </Link>
              <Link className={styles.secondary} href="/app/budget">
                {t('todayCost')}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className={styles.hint} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
