import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, fromDecimal, formatMoney } from '@globetrot/domain';
import { formatLocalDate, formatYearMonth, type SupportedLocale } from '@globetrot/i18n';
import { Banner, StatusMark } from '@globetrot/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { BudgetData, ExpenseData } from '../../../lib/trips';
import type { Option } from '../../settings/options';
import { addExpense, removeExpense, saveSavings } from './actions';
import { answerOf } from './answer';
import styles from './budget.module.css';

const FLASH: Record<string, { tone: 'success' | 'error'; key: string }> = {
  'expense-added': { tone: 'success', key: 'expenseAdded' },
  'expense-removed': { tone: 'success', key: 'expenseRemoved' },
  'expense-error': { tone: 'error', key: 'expenseError' },
  'savings-saved': { tone: 'success', key: 'savingsSaved' },
  'savings-error': { tone: 'error', key: 'savingsError' },
};

/**
 * The budget of the current trip. Everything is derived on the server by the same rules the domain tests cover:
 * the totals add up costs already converted to the trip's currency, and the answer sentence comes from the
 * savings plan. Costs in other currencies show the amount typed, the converted amount and the rate that was used.
 */
export function BudgetView({
  trip,
  budget,
  expenses,
  currencies,
  status,
}: {
  trip: { id: string; title: string; currency: string } | null;
  budget: BudgetData | null;
  expenses: readonly ExpenseData[];
  currencies: readonly Option[];
  status: string | undefined;
}) {
  const t = useTranslations('budgetPage');
  const savingsText = useTranslations('savings');
  const locale = useLocale() as SupportedLocale;

  if (trip === null) {
    return (
      <section className={styles.page}>
        <h1>{t('title')}</h1>
        <p className={styles.lead}>{t('noTrip')}</p>
        <Link className={styles.action} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }
  if (budget === null) {
    return (
      <section className={styles.page}>
        <h1>{t('title')}</h1>
        <Banner tone="error" role="alert">
          {t('loadError')}
        </Banner>
      </section>
    );
  }

  const money = (value: { amount: string; currency: string }) =>
    formatMoney(fromDecimal(value.amount, value.currency), locale);
  const flash = status ? FLASH[status] : undefined;
  const plan = budget.savings;
  const answer = answerOf(plan);
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  const progress = Math.round(plan.progressBasisPoints / 100);
  const hasCosts = plan.status !== 'no-costs';

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{trip.title}</p>
      <h1>{t('title')}</h1>

      {flash ? (
        <Banner tone={flash.tone} role={flash.tone === 'error' ? 'alert' : 'status'}>
          {t(flash.key)}
        </Banner>
      ) : null}

      <div className={styles.answer} aria-labelledby="answer-title">
        <h2 id="answer-title" className={styles.answerTitle}>
          {t('answerTitle')}
        </h2>
        <p className={styles.sentence}>
          {answer.kind === 'noCosts' ? savingsText('noCosts') : null}
          {answer.kind === 'fullySaved' ? savingsText('fullySaved') : null}
          {answer.kind === 'yes'
            ? savingsText.rich('answerYes', {
                strong,
                month: formatYearMonth(answer.month, locale),
                amount: money(plan.monthly),
              })
            : null}
          {answer.kind === 'almost'
            ? savingsText.rich('answerAlmost', {
                strong,
                month: formatYearMonth(answer.month, locale),
                monthly: money(plan.monthly),
                departure: formatLocalDate(answer.departure, locale, { dateStyle: 'long' }),
              })
            : null}
          {answer.kind === 'setMonthly' ? t('setMonthly') : null}
        </p>
        {answer.kind === 'setMonthly' && answer.needed && answer.departure ? (
          <p className={styles.note}>
            {t('neededByDeparture', {
              date: formatLocalDate(answer.departure, locale, { dateStyle: 'long' }),
              amount: money({ amount: answer.needed, currency: trip.currency }),
            })}
          </p>
        ) : null}
        {hasCosts ? (
          <div className={styles.progress}>
            <progress
              value={plan.progressBasisPoints}
              max={10000}
              aria-label={t('progressLabel', {
                saved: money(plan.saved),
                total: money(budget.total),
              })}
            />
            <span>
              {t('progressText', {
                percent: progress,
                saved: money(plan.saved),
                total: money(budget.total),
              })}
            </span>
          </div>
        ) : null}
        <p className={styles.disclaimer}>{savingsText('disclaimer')}</p>
      </div>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="costs-title">
          <h2 id="costs-title">{t('costsTitle')}</h2>
          <p className={styles.total}>
            <span>{t('total')}</span> <strong>{money(budget.total)}</strong>
          </p>
          {expenses.length === 0 ? (
            <p className={styles.note}>{t('noExpenses')}</p>
          ) : (
            <ul className={styles.expenses}>
              {expenses.map((expense) => (
                <li key={expense.id}>
                  <div className={styles.expenseMain}>
                    <strong>{expense.description}</strong>
                    <span className={styles.meta}>
                      {t(`categories.${expense.category}`)}{' '}
                      <StatusMark status={expense.status}>
                        {t(`statuses.${expense.status}`)}
                      </StatusMark>
                    </span>
                    {expense.fx ? (
                      <span className={styles.meta}>
                        {t('fxNote', {
                          original: money(expense.original),
                          rate: expense.fx.rate,
                          currency: trip.currency,
                          date: formatLocalDate(expense.fx.asOf, locale, { dateStyle: 'medium' }),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.amount}>{money(expense.inTripCurrency)}</span>
                  <form action={removeExpense}>
                    <input type="hidden" name="tripId" value={trip.id} />
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <button
                      type="submit"
                      className={styles.remove}
                      aria-label={t('removeExpense', { description: expense.description })}
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {hasCosts ? (
            <>
              <h3>{t('byCategory')}</h3>
              <ul className={styles.breakdown}>
                {budget.byCategory
                  .filter((entry) => Number(entry.amount.amount) > 0)
                  .map((entry) => (
                    <li key={entry.category}>
                      <span>{t(`categories.${entry.category}`)}</span>
                      <span>{money(entry.amount)}</span>
                    </li>
                  ))}
              </ul>
              <h3>{t('byStatus')}</h3>
              <ul className={styles.breakdown}>
                {budget.byStatus
                  .filter((entry) => Number(entry.amount.amount) > 0)
                  .map((entry) => (
                    <li key={entry.status}>
                      <StatusMark status={entry.status}>{t(`statuses.${entry.status}`)}</StatusMark>
                      <span>{money(entry.amount)}</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
        </section>

        <div className={styles.side}>
          <section className={styles.card} aria-labelledby="add-title">
            <h2 id="add-title">{t('addTitle')}</h2>
            <form action={addExpense} className={styles.form} id="add-expense-form">
              <input type="hidden" name="tripId" value={trip.id} />
              <label className={styles.field}>
                <span>{t('description')}</span>
                <input name="description" required maxLength={120} autoComplete="off" />
              </label>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span>{t('category')}</span>
                  <select name="category" defaultValue="flights">
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {t(`categories.${category}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>{t('status')}</span>
                  <select name="status" defaultValue="estimate">
                    {EXPENSE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {t(`statuses.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span>{t('amount')}</span>
                  <input name="amount" required inputMode="decimal" autoComplete="off" />
                </label>
                <label className={styles.field}>
                  <span>{t('currency')}</span>
                  <select name="currency" defaultValue={trip.currency}>
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.field}>
                <span>{t('fxRate', { currency: trip.currency })}</span>
                <input name="fxRate" inputMode="decimal" autoComplete="off" />
                <small>{t('fxHelp', { currency: trip.currency })}</small>
              </label>
              <button type="submit" className={styles.primary}>
                {t('add')}
              </button>
            </form>
          </section>

          <section className={styles.card} aria-labelledby="savings-title">
            <h2 id="savings-title">{t('savingsTitle')}</h2>
            <form action={saveSavings} className={styles.form} id="savings-form">
              <input type="hidden" name="tripId" value={trip.id} />
              <div className={styles.row}>
                <label className={styles.field}>
                  <span>{t('savedSoFar', { currency: trip.currency })}</span>
                  <input
                    name="saved"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={plan.saved.amount}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t('perMonth', { currency: trip.currency })}</span>
                  <input
                    name="monthly"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={plan.monthly.amount}
                  />
                </label>
              </div>
              <button type="submit" className={styles.primary}>
                {t('saveSavings')}
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
