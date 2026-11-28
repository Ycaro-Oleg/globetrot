'use client';

import { formatLocalDate, type SupportedLocale } from '@globetrot/i18n';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  categoryRows,
  moneyFigures,
  niceCeil,
  savingsSeries,
  statusRows,
  type BudgetMoney,
  type SavingsHistory,
  type SavingsPoint,
} from './money-series';
import { STATUS_GLYPH } from './status-glyph';
import styles from './money.module.css';

/**
 * The trip's money at a glance (shadcn-style charts on Recharts, drawn with the app's tokens): the headline
 * figures, how the savings grew and where the plan takes them, and, on the budget page, where the money goes and
 * how much of it is settled. Every chart has its numbers in a table for screen readers and keyboard users.
 */
export function MoneyPanel({
  budget,
  history,
  today,
  variant,
}: {
  budget: BudgetMoney;
  history: SavingsHistory | null;
  /** `YYYY-MM-DD` in the person's calendar. */
  today: string;
  /** `summary` on the trip's overview, `full` on the budget page. */
  variant: 'summary' | 'full';
}) {
  const t = useTranslations('money');
  const locale = useLocale() as SupportedLocale;
  const figures = moneyFigures(budget);
  const currency = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: budget.currency,
    maximumFractionDigits: 0,
  });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const month = (yyyyMm: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${yyyyMm}-15T12:00:00Z`),
    );
  const titleId = useId();

  if (figures.status === 'no-costs') {
    return (
      <section className={styles.panel} aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {t('title')}
        </h2>
        <p className={styles.muted}>{t('noCosts')}</p>
        {variant === 'summary' ? (
          <Link href="/app/budget" className={styles.link}>
            {t('seeBudget')}
          </Link>
        ) : null}
      </section>
    );
  }

  const ready =
    figures.status === 'fully-saved'
      ? t('readyDone')
      : figures.readyMonth
        ? t('ready', { month: month(figures.readyMonth) })
        : t('readyNever');

  return (
    <section className={styles.panel} aria-labelledby={titleId} data-variant={variant}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {t('title')}
        </h2>
        {variant === 'summary' ? (
          <Link href="/app/budget" className={styles.link}>
            {t('seeBudget')}
          </Link>
        ) : null}
      </div>

      <dl className={styles.figures}>
        <div className={styles.figure}>
          <dt>{t('total')}</dt>
          <dd className={styles.amount}>{currency.format(figures.total)}</dd>
        </div>
        <div className={styles.figure}>
          <dt>{t('saved')}</dt>
          <dd className={styles.amount}>{currency.format(figures.saved)}</dd>
          <dd className={styles.note}>
            <span className={styles.meter} aria-hidden="true">
              <span style={{ width: `${Math.round(figures.share * 100)}%` }} />
            </span>
            {t('savedShare', { share: percent.format(figures.share) })}
          </dd>
        </div>
        <div className={styles.figure}>
          <dt>{t('left')}</dt>
          <dd className={styles.amount}>{currency.format(figures.left)}</dd>
          <dd className={styles.note}>{ready}</dd>
        </div>
        <div className={styles.figure}>
          <dt>{t('monthly')}</dt>
          <dd className={styles.amount}>{currency.format(figures.monthly)}</dd>
          <dd className={styles.note}>
            {figures.monthlyNeeded !== null && figures.onTime === false
              ? t('monthlyNeeded', { amount: currency.format(figures.monthlyNeeded) })
              : t('monthlyPlan')}
          </dd>
        </div>
      </dl>

      {history ? (
        <SavingsChart
          series={savingsSeries(history, budget, today)}
          money={(n) => currency.format(n)}
          date={(d, style) =>
            formatLocalDate(
              d,
              locale,
              style === 'long'
                ? { day: 'numeric', month: 'short', year: 'numeric' }
                : style === 'day'
                  ? { day: 'numeric', month: 'short' }
                  : { month: 'short', year: '2-digit' },
            )
          }
          height={variant === 'full' ? 280 : 200}
        />
      ) : null}

      {variant === 'full' ? (
        <div className={styles.split}>
          <CategoryChart budget={budget} money={(n) => currency.format(n)} percent={percent} />
          <StatusBreakdown budget={budget} money={(n) => currency.format(n)} percent={percent} />
        </div>
      ) : null}
    </section>
  );
}

type Format = (value: number) => string;

function SavingsChart({
  series,
  money,
  date,
  height,
}: {
  series: { readonly points: readonly SavingsPoint[]; readonly goal: number };
  money: Format;
  /** `long` for the table and tooltip, `day` or `month` for the axis. */
  date: (iso: string, style: 'long' | 'day' | 'month') => string;
  height: number;
}) {
  const t = useTranslations('money');
  const gradient = useId().replace(/:/g, '');
  const titleId = useId();
  const { points, goal } = series;
  const planEnd = [...points]
    .reverse()
    .find((point) => point.plan !== null && point.saved === null);
  const last = points.at(-1)!;
  const now = points.find((point) => point.saved !== null && point.plan !== null);
  const summary =
    planEnd && planEnd.plan! >= goal
      ? t('savingsSummary', {
          saved: money(now?.saved ?? 0),
          goal: money(goal),
          date: date(planEnd.date, 'long'),
        })
      : t('savingsSummaryNoPlan', { saved: money(now?.saved ?? 0), goal: money(goal) });
  const top = niceCeil(
    Math.max(goal, ...points.map((point) => point.plan ?? point.saved ?? 0)) * 1.05,
  );
  const hasPlan = points.some((point) => point.saved === null && point.plan !== null);
  // Short spans read day by day; longer ones month by month.
  const span = (Date.parse(last.date) - Date.parse(points[0]!.date)) / 86_400_000;
  const tickStyle = span <= 120 ? 'day' : 'month';

  return (
    <figure className={styles.chartCard} aria-labelledby={titleId}>
      <figcaption className={styles.chartHead}>
        <span id={titleId} className={styles.chartTitle}>
          {t('savingsChart')}
        </span>
        <span className={styles.muted}>{summary}</span>
      </figcaption>
      <ul className={styles.legend} aria-hidden="true">
        <li data-series="saved">{t('legendSaved')}</li>
        {hasPlan ? <li data-series="plan">{t('legendPlan')}</li> : null}
        <li data-series="goal">{t('legendGoal')}</li>
      </ul>
      <div className={styles.chart} style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            accessibilityLayer={false}
            data={points as SavingsPoint[]}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-saved)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--chart-saved)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => date(value, tickStyle)}
              stroke="var(--chart-axis)"
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              domain={[0, top]}
              ticks={[0, top / 4, top / 2, (top * 3) / 4, top]}
              tickFormatter={(value: number) => money(value)}
              stroke="var(--chart-axis)"
              fontSize={12}
            />
            <ReferenceLine
              y={goal}
              stroke="var(--chart-goal)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
            <Tooltip
              cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className={styles.tooltip}>
                    <span className={styles.tooltipLabel}>{date(String(label), 'long')}</span>
                    {payload
                      .filter((entry) => entry.value !== null && entry.value !== undefined)
                      .map((entry) => (
                        <span key={String(entry.dataKey)} className={styles.tooltipRow}>
                          <i data-series={String(entry.dataKey)} />
                          {entry.dataKey === 'saved' ? t('legendSaved') : t('legendPlan')}
                          <b>{money(Number(entry.value))}</b>
                        </span>
                      ))}
                  </div>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="saved"
              stroke="var(--chart-saved)"
              strokeWidth={2.5}
              fill={`url(#${gradient})`}
              connectNulls={false}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="plan"
              stroke="var(--chart-plan)"
              strokeWidth={2}
              strokeDasharray="5 5"
              connectNulls
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>{t('savingsChart')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('tableDate')}</th>
              <th scope="col">{t('legendSaved')}</th>
              <th scope="col">{t('legendPlan')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <th scope="row">{date(point.date, 'long')}</th>
                <td>{point.saved === null ? '—' : money(point.saved)}</td>
                <td>{point.plan === null ? '—' : money(point.plan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sr-only">{t('legendGoal') + ': ' + money(goal)}</p>
      {last.plan !== null && last.plan < goal ? (
        <p className={styles.note}>{t('planShort')}</p>
      ) : null}
    </figure>
  );
}

function CategoryChart({
  budget,
  money,
  percent,
}: {
  budget: BudgetMoney;
  money: Format;
  percent: Intl.NumberFormat;
}) {
  const t = useTranslations('money');
  const tb = useTranslations('budgetPage');
  const titleId = useId();
  const rows = categoryRows(budget).map((row) => ({
    ...row,
    label: tb(`categories.${row.category}` as 'categories.flights'),
  }));
  return (
    <figure className={styles.chartCard} aria-labelledby={titleId}>
      <figcaption className={styles.chartHead}>
        <span id={titleId} className={styles.chartTitle}>
          {t('byCategory')}
        </span>
      </figcaption>
      <div
        className={styles.chart}
        style={{ height: Math.max(120, rows.length * 40) }}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={132}
              stroke="var(--chart-axis)"
              fontSize={13}
            />
            <Bar dataKey="amount" fill="var(--chart-bar)" radius={6} isAnimationActive={false}>
              <LabelList
                dataKey="amount"
                position="right"
                formatter={(value: unknown) => money(Number(value))}
                fill="var(--chart-label)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>{t('byCategory')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('tableCategory')}</th>
              <th scope="col">{t('tableAmount')}</th>
              <th scope="col">{t('tableShare')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category}>
                <th scope="row">{row.label}</th>
                <td>{money(row.amount)}</td>
                <td>{percent.format(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** How much of the cost is settled: one bar split by status, each part with its glyph and word (never colour alone). */
function StatusBreakdown({
  budget,
  money,
  percent,
}: {
  budget: BudgetMoney;
  money: Format;
  percent: Intl.NumberFormat;
}) {
  const t = useTranslations('money');
  const tb = useTranslations('budgetPage');
  const titleId = useId();
  const rows = statusRows(budget);
  return (
    <figure className={styles.chartCard} aria-labelledby={titleId}>
      <figcaption className={styles.chartHead}>
        <span id={titleId} className={styles.chartTitle}>
          {t('byStatus')}
        </span>
      </figcaption>
      <div className={styles.stack} aria-hidden="true">
        {rows
          .filter((row) => row.share > 0)
          .map((row) => (
            <span key={row.status} data-status={row.status} style={{ flexGrow: row.share }}>
              {row.share >= 0.08 ? STATUS_GLYPH[row.status] : ''}
            </span>
          ))}
      </div>
      <ul className={styles.statusList}>
        {rows.map((row) => (
          <li key={row.status}>
            <span className={styles.statusGlyph} data-status={row.status} aria-hidden="true">
              {STATUS_GLYPH[row.status]}
            </span>
            <span className={styles.statusName}>{tb(`statuses.${row.status}`)}</span>
            <span className={styles.statusAmount}>{money(row.amount)}</span>
            <span className={styles.statusShare}>{percent.format(row.share)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t('estimateNote')}</p>
    </figure>
  );
}
