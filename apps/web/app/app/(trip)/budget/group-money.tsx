'use client';

import { formatMoney, fromDecimal } from '@globetrot/domain';
import type { SupportedLocale } from '@globetrot/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { saveMyMoney } from './actions';
import styles from './budget.module.css';

type Amount = { amount: string; currency: string };

export interface GroupMoneyData {
  readonly currency: string;
  readonly custom: boolean;
  readonly people: readonly {
    userId: string;
    name: string;
    you: boolean;
    shareBp: number | null;
    share: Amount;
    saved: Amount;
    monthly: Amount;
    left: Amount;
    readyMonth: string | null;
  }[];
  readonly group: { total: Amount; saved: Amount; left: Amount };
  readonly settlement: {
    transfers: readonly {
      from: string;
      to: string;
      fromName: string;
      toName: string;
      amount: Amount;
    }[];
    paid: Amount;
    unassigned: Amount;
  };
}

const plain = (amount: string) => amount.replace(/\.00$/, '');

/**
 * Money on a trip planned together (ADR-0025): your part and your own savings for it, everyone's progress
 * (in words and bars, never colour alone), and who pays whom for what was already paid.
 */
export function GroupMoney({ tripId, group }: { tripId: string; group: GroupMoneyData }) {
  const t = useTranslations('groupMoney');
  const locale = useLocale() as SupportedLocale;
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const me = group.people.find((person) => person.you);
  const [saved, setSaved] = useState(plain(me?.saved.amount ?? '0'));
  const [monthly, setMonthly] = useState(plain(me?.monthly.amount ?? '0'));
  const [status, setStatus] = useState('');
  const fmt = (value: Amount) =>
    formatMoney(fromDecimal(value.amount, value.currency), locale, { precision: 'whole' });
  const month = (yyyyMm: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${yyyyMm}-15T12:00:00Z`),
    );
  const percent = (part: Amount, whole: Amount) => {
    const total = Number(whole.amount);
    return total > 0 ? Math.min(100, Math.round((Number(part.amount) / total) * 100)) : 0;
  };

  const save = () =>
    startTransition(async () => {
      const ok = await saveMyMoney(tripId, {
        saved: saved.trim().replace(',', '.') || '0',
        monthly: monthly.trim().replace(',', '.') || '0',
      });
      setStatus(ok ? t('saved') : t('error'));
      if (ok) router.refresh();
    });

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div className={styles.listHead}>
        <h2 id={`${id}-title`}>{t('title')}</h2>
        <span>{group.custom ? t('custom') : t('equal', { count: group.people.length })}</span>
      </div>

      {me ? (
        <div className={styles.myPart}>
          <p className={styles.myPartLead}>
            {Number(me.left.amount) <= 0
              ? t('meReady', { share: fmt(me.share) })
              : me.readyMonth
                ? t('meBy', { share: fmt(me.share), month: month(me.readyMonth) })
                : t('meNoMonthly', { share: fmt(me.share), left: fmt(me.left) })}
          </p>
          <div className={styles.myPartFields}>
            <label className={styles.field}>
              <span>{t('mySaved')}</span>
              <span className={styles.moneyInput}>
                <span aria-hidden="true">{group.currency}</span>
                <input
                  id={`${id}-saved`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={saved}
                  onChange={(event) => setSaved(event.target.value)}
                />
              </span>
            </label>
            <label className={styles.field}>
              <span>{t('myMonthly')}</span>
              <span className={styles.moneyInput}>
                <span aria-hidden="true">{group.currency}</span>
                <input
                  id={`${id}-monthly`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={monthly}
                  onChange={(event) => setMonthly(event.target.value)}
                />
              </span>
            </label>
            <button type="button" className={styles.secondary} disabled={pending} onClick={save}>
              {t('save')}
            </button>
          </div>
          <p className={styles.footnote} role="status" aria-live="polite">
            {status}
          </p>
        </div>
      ) : null}

      <ul className={styles.people}>
        {group.people.map((person) => (
          <li key={person.userId}>
            <span className={styles.personLine}>
              <strong>{person.you ? t('you', { name: person.name }) : person.name}</strong>
              <span>{t('progress', { saved: fmt(person.saved), share: fmt(person.share) })}</span>
            </span>
            <span
              className={styles.personBar}
              role="progressbar"
              aria-label={person.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent(person.saved, person.share)}
            >
              <span style={{ width: `${percent(person.saved, person.share)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.footnote}>
        {t('group', { saved: fmt(group.group.saved), total: fmt(group.group.total) })}
      </p>

      <h3 className={styles.settleTitle}>{t('settleTitle')}</h3>
      {group.settlement.transfers.length ? (
        <ul className={styles.transfers}>
          {group.settlement.transfers.map((transfer) => (
            <li key={`${transfer.from}-${transfer.to}`}>
              {t('transfer', {
                from: transfer.from === me?.userId ? t('youShort') : transfer.fromName,
                to: transfer.to === me?.userId ? t('youObject') : transfer.toName,
                amount: fmt(transfer.amount),
              })}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.footnote}>
          {Number(group.settlement.paid.amount) > 0 ? t('even') : t('nothingPaid')}
        </p>
      )}
      {Number(group.settlement.unassigned.amount) > 0 ? (
        <p className={styles.footnote}>
          {t('unassigned', { amount: fmt(group.settlement.unassigned) })}
        </p>
      ) : null}
    </section>
  );
}
