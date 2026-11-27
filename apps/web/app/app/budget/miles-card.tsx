'use client';

import { formatMoney, fromDecimal, MILES_PROGRAMS, type MilesProgram } from '@globetrot/domain';
import type { SupportedLocale } from '@globetrot/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { saveMiles } from './actions';
import styles from './budget.module.css';

type Amount = { amount: string; currency: string };

export interface MilesData {
  readonly programs: readonly {
    program: MilesProgram;
    balance: number;
    onTrip: number;
    value: { low: Amount; high: Amount };
  }[];
  readonly researchedOn: string;
  readonly sources: readonly string[];
  readonly applied: { low: Amount; high: Amount; middle: Amount } | null;
  readonly withMiles: { left: Amount; readyMonth: string | null } | null;
}

/**
 * Miles as part of the saving (ADR-0030): balances per programme, how many go towards this trip, and the answer
 * counting them. Every value is a researched range, labelled as an estimate with its date and sources.
 */
export function MilesCard({ tripId, miles }: { tripId: string; miles: MilesData }) {
  const t = useTranslations('miles');
  const locale = useLocale() as SupportedLocale;
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const byProgram = new Map(miles.programs.map((entry) => [entry.program, entry]));
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        MILES_PROGRAMS.map((program) => [
          program,
          {
            balance: String(byProgram.get(program)?.balance ?? ''),
            onTrip: String(byProgram.get(program)?.onTrip || ''),
          },
        ]),
      ) as Record<MilesProgram, { balance: string; onTrip: string }>,
  );
  const [status, setStatus] = useState('');
  const fmt = (value: Amount) =>
    formatMoney(fromDecimal(value.amount, value.currency), locale, { precision: 'whole' });
  const month = (yyyyMm: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${yyyyMm}-15T12:00:00Z`),
    );
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${miles.researchedOn}T12:00:00Z`),
  );
  const onTripTotal = miles.programs.reduce((sum, entry) => sum + entry.onTrip, 0);
  const whole = (text: string) => {
    const digits = text.replace(/\D/g, '');
    return digits === '' ? 0 : Number(digits);
  };

  const save = () =>
    startTransition(async () => {
      const changes = MILES_PROGRAMS.map((program) => ({
        program,
        balance: whole(values[program].balance),
        onTrip: Math.min(whole(values[program].onTrip), whole(values[program].balance)),
      })).filter(
        (entry) =>
          entry.balance !== (byProgram.get(entry.program)?.balance ?? 0) ||
          entry.onTrip !== (byProgram.get(entry.program)?.onTrip ?? 0),
      );
      const ok = await saveMiles(tripId, changes);
      setStatus(ok ? t('saved') : t('error'));
      if (ok) router.refresh();
    });

  const form = (
    <>
      <table className={styles.milesTable}>
        <thead>
          <tr>
            <th scope="col">{t('program')}</th>
            <th scope="col">{t('balance')}</th>
            <th scope="col">{t('onTrip')}</th>
          </tr>
        </thead>
        <tbody>
          {MILES_PROGRAMS.map((program) => {
            const entry = byProgram.get(program);
            return (
              <tr key={program}>
                <th scope="row">
                  {t(`programs.${program}`)}
                  {entry ? (
                    <span>
                      {t('worth', { low: fmt(entry.value.low), high: fmt(entry.value.high) })}
                    </span>
                  ) : null}
                </th>
                <td>
                  <input
                    inputMode="numeric"
                    aria-label={t('balanceOf', { program: t(`programs.${program}`) })}
                    value={values[program].balance}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [program]: { ...current[program], balance: event.target.value },
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    aria-label={t('onTripOf', { program: t(`programs.${program}`) })}
                    value={values[program].onTrip}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [program]: { ...current[program], onTrip: event.target.value },
                      }))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className={styles.secondary} disabled={pending} onClick={save}>
        {t('save')}
      </button>
    </>
  );

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div className={styles.listHead}>
        <h2 id={`${id}-title`}>{t('title')}</h2>
      </div>
      {miles.applied && miles.withMiles ? (
        <p className={styles.myPartLead}>
          {Number(miles.withMiles.left.amount) <= 0
            ? t('answerReady', { miles: onTripTotal, value: fmt(miles.applied.middle) })
            : miles.withMiles.readyMonth
              ? t('answerBy', {
                  miles: onTripTotal,
                  value: fmt(miles.applied.middle),
                  left: fmt(miles.withMiles.left),
                  month: month(miles.withMiles.readyMonth),
                })
              : t('answerLeft', {
                  miles: onTripTotal,
                  value: fmt(miles.applied.middle),
                  left: fmt(miles.withMiles.left),
                })}
        </p>
      ) : (
        <p className={styles.footnote}>{t('intro')}</p>
      )}
      {miles.programs.length === 0 ? (
        <details className={styles.milesMore}>
          <summary>{t('add')}</summary>
          {form}
        </details>
      ) : (
        form
      )}
      <p className={styles.footnote}>{t('note', { date, sources: miles.sources.join(', ') })}</p>
      <p className={styles.footnote} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
