/**
 * The numbers behind the trip's money charts, worked out from what the API already answers (the budget and the
 * savings history). Pure functions: no formatting, no React, so they are easy to test.
 */

export type Amount = { readonly amount: string; readonly currency: string };

export type SavingsHistory = {
  readonly currency: string;
  readonly saved: Amount;
  readonly start: Amount;
  readonly weeks: readonly {
    readonly week: string;
    readonly amount: Amount;
    readonly saved: Amount;
  }[];
};

export type BudgetMoney = {
  readonly currency: string;
  readonly total: Amount;
  readonly byCategory: readonly { readonly category: string; readonly amount: Amount }[];
  readonly byStatus: readonly { readonly status: string; readonly amount: Amount }[];
  readonly savings: {
    readonly status: 'no-costs' | 'fully-saved' | 'saving';
    readonly saved: Amount;
    readonly monthly: Amount;
    readonly left: Amount;
    readonly progressBasisPoints: number;
    readonly readyMonth: string | null;
    readonly departure: string | null;
    readonly monthlyNeeded: Amount | null;
    readonly onTime: boolean | null;
  };
};

/** One point of the savings chart: a day, what was set aside by then, the plan from today on, and the goal. */
export type SavingsPoint = {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** What was really set aside by then (null in the future). */
  readonly saved: number | null;
  /** Where the monthly plan takes the savings (null in the past, except today, where the two lines meet). */
  readonly plan: number | null;
};

const value = (amount: Amount) => Number(amount.amount);

/** The Monday of an ISO week (`2027-W05` → `2027-02-01`), as `YYYY-MM-DD`. */
export function mondayOfIsoWeek(week: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) throw new RangeError(`Not an ISO week: "${week}"`);
  const year = Number(match[1]);
  const index = Number(match[2]);
  // 4 January is always in week 1; step back to that week's Monday, then forward.
  const jan4 = Date.UTC(year, 0, 4);
  const weekday = (new Date(jan4).getUTCDay() + 6) % 7;
  return new Date(jan4 + ((index - 1) * 7 - weekday) * 86_400_000).toISOString().slice(0, 10);
}

/** The same day `months` later (clamped to the month's last day), as `YYYY-MM-DD`. */
function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** How many plan months to draw: up to the departure (or the month the plan is ready), never more than two years. */
const MAX_PLAN_MONTHS = 24;

/**
 * The savings chart: the real balance week by week (from the check-ins, starting at what was typed in), joined at
 * today by the plan: the monthly amount added month by month until the goal or the departure.
 */
export function savingsSeries(
  history: SavingsHistory,
  budget: BudgetMoney,
  today: string,
): { readonly points: readonly SavingsPoint[]; readonly goal: number } {
  const goal = value(budget.total);
  const savedNow = value(history.saved);
  const points: SavingsPoint[] = [];

  if (history.weeks.length > 0) {
    const first = mondayOfIsoWeek(history.weeks[0]!.week);
    // The balance before the first check-in, a week earlier, so the area starts where the savings did.
    points.push({ date: addDays(first, -7), saved: value(history.start), plan: null });
    for (const week of history.weeks) {
      const date = mondayOfIsoWeek(week.week);
      if (date <= today) points.push({ date, saved: value(week.saved), plan: null });
    }
  }
  // Today, where the real line ends and the plan begins.
  points.push({ date: today, saved: savedNow, plan: savedNow });

  const monthly = value(budget.savings.monthly);
  if (monthly > 0 && savedNow < goal) {
    const end = budget.savings.departure;
    let balance = savedNow;
    for (let month = 1; month <= MAX_PLAN_MONTHS; month++) {
      const date = addMonths(today, month);
      if (end && date > end) break;
      balance = Math.min(goal, balance + monthly);
      points.push({ date, saved: null, plan: balance });
      if (balance >= goal) break;
    }
  }
  return { points, goal };
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The trip's costs per category, largest first, without empty ones, each with its share of the total. */
export function categoryRows(budget: BudgetMoney) {
  const total = value(budget.total);
  return budget.byCategory
    .map((row) => ({ category: row.category, amount: value(row.amount) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((row) => ({ ...row, share: total > 0 ? row.amount / total : 0 }));
}

/** The order the statuses read in, from money already gone to money not yet known. */
export const STATUS_ORDER = ['paid', 'confirmed', 'estimate', 'unknown'] as const;

/** The trip's costs per status, in a fixed order, each with its share of the total (empty ones kept at 0). */
export function statusRows(budget: BudgetMoney) {
  const total = value(budget.total);
  return STATUS_ORDER.map((status) => {
    const amount = value(
      budget.byStatus.find((row) => row.status === status)?.amount ?? {
        amount: '0',
        currency: budget.currency,
      },
    );
    return { status, amount, share: total > 0 ? amount / total : 0 };
  });
}

/** The headline numbers: the total, what is saved and its share, what is left, and what a month takes. */
export function moneyFigures(budget: BudgetMoney) {
  const total = value(budget.total);
  const saved = value(budget.savings.saved);
  return {
    total,
    saved,
    left: value(budget.savings.left),
    share: total > 0 ? Math.min(1, saved / total) : 0,
    monthly: value(budget.savings.monthly),
    monthlyNeeded: budget.savings.monthlyNeeded ? value(budget.savings.monthlyNeeded) : null,
    readyMonth: budget.savings.readyMonth,
    onTime: budget.savings.onTime,
    status: budget.savings.status,
  };
}

/** A round number at or above `value` for the top of an axis (1, 2, 2.5, 5 or 10 times a power of ten). */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}
