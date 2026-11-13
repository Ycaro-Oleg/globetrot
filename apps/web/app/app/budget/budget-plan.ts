import {
  addMonths,
  compare,
  fromDecimal,
  money,
  savingsPlan,
  yearMonthOf,
  type LocalDate,
  type Money,
  type SavingsPlan,
  type YearMonth,
} from '@globetrot/domain';

/**
 * The budget screen recomputes the savings answer while the monthly slider moves, with the domain's own rule
 * (`savingsPlan`), so the sentence never comes from a guess in the screen. The trip's total is already converted
 * on the server; here it stands in for the costs.
 */
export function livePlan(input: {
  readonly total: Money;
  readonly saved: Money;
  readonly monthly: Money;
  readonly startDate: LocalDate | null;
  readonly today: LocalDate;
}): SavingsPlan {
  const { total } = input;
  return savingsPlan(
    {
      currency: total.currency,
      startDate: input.startDate,
      stops: [],
      checklist: [],
      expenses:
        total.amountMinor > 0n
          ? [{ id: 'total', category: 'other', stopId: null, status: 'estimate', amount: total }]
          : [],
      savings: { saved: input.saved, monthly: input.monthly },
    },
    input.today,
  );
}

/** A plain amount typed by a person ("1450", "1.450,50" is not accepted, "1450,50" is) as money, or null. */
export function parseAmount(text: string, currency: string): Money | null {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  try {
    return fromDecimal(cleaned, currency);
  } catch {
    return null;
  }
}

export interface ChartBar {
  readonly month: YearMonth;
  /** What is set aside by the end of this month at the current pace. */
  readonly value: Money;
  /** The goal is reached by this month. */
  readonly done: boolean;
  /** The first month that reaches the goal. */
  readonly ready: boolean;
  /** This month (real), not a projection. */
  readonly now: boolean;
  readonly departure: boolean;
}

/**
 * Six months of savings, from this month to departure when that is near, at the current monthly pace: what is
 * already saved this month, then the projection. Marks the first month that reaches the total.
 */
export function chartBars(input: {
  readonly total: Money;
  readonly saved: Money;
  readonly monthly: Money;
  readonly today: LocalDate;
  readonly startDate: LocalDate | null;
}): ChartBar[] {
  const start = yearMonthOf(input.today);
  const departure = input.startDate === null ? null : yearMonthOf(input.startDate);
  const bars: ChartBar[] = [];
  let readySeen = false;
  for (let k = 0; k < 6; k++) {
    const month = addMonths(start, k);
    const value = money(
      input.saved.amountMinor + input.monthly.amountMinor * BigInt(k),
      input.total.currency,
    );
    const done = input.total.amountMinor > 0n && compare(value, input.total) >= 0;
    const ready = done && !readySeen;
    if (done) readySeen = true;
    bars.push({ month, value, done, ready, now: k === 0, departure: month === departure });
    if (departure !== null && month >= departure) break;
  }
  return bars;
}
