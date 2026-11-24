import { compare, isZero, minorUnitExponent, money, subtract, zero, type Money } from '../money';
import {
  addMonths,
  compareLocalDates,
  fullMonthsBetween,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '../time';
import { tripTotals } from './totals';
import type { TripPlan } from './types';

export type SavingsStatus =
  /** No expenses yet, so there is nothing to save for. */
  | 'no-costs'
  /** Saved ≥ total. */
  | 'fully-saved'
  /** Still something left to save. */
  | 'saving';

export interface SavingsPlan {
  readonly status: SavingsStatus;
  readonly total: Money;
  readonly saved: Money;
  /** max(0, total − saved). */
  readonly left: Money;
  /** saved ÷ total in basis points (0–10 000), capped at 10 000; 0 when there are no costs. */
  readonly progressBasisPoints: number;

  /** Months of the current monthly contribution needed to cover `left`. `null` when monthly is 0. */
  readonly monthsNeeded: number | null;
  /** Month the goal is reached at the current pace (today's month + monthsNeeded). `null` when monthly is 0. */
  readonly readyMonth: YearMonth | null;

  readonly departure: LocalDate | null;
  /** True when the departure date is today or in the past. */
  readonly departed: boolean;
  /** Whole months between today and departure. `null` without a departure date. */
  readonly monthsUntilDeparture: number | null;
  /**
   * Monthly amount that covers `left` by departure, rounded up to a friendly step.
   * Equals `left` when departure is less than a month away. `null` without a departure date or when nothing is left.
   */
  readonly monthlyNeeded: Money | null;
  /** True when the current pace reaches the goal by departure. `null` without a departure date. */
  readonly onTime: boolean | null;
}

/**
 * Rounds a positive minor-unit amount up to three significant digits, and to at least one
 * major unit: USD 1,825.37 → 1,830; JPY 182,543 → 183,000; USD 36.20 → 37.
 */
export function roundUpFriendly(value: Money): Money {
  if (value.amountMinor <= 0n) return value;
  const major = 10n ** BigInt(minorUnitExponent(value.currency));
  const significant = 10n ** BigInt(Math.max(0, value.amountMinor.toString().length - 3));
  const step = significant > major ? significant : major;
  const rounded = ((value.amountMinor + step - 1n) / step) * step;
  return money(rounded, value.currency);
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/**
 * Answers "can I afford this, and when?" (business rules: Savings plan).
 * `today` is injected so the rule stays pure and testable.
 */
export function savingsPlan(trip: TripPlan, today: LocalDate): SavingsPlan {
  const { total } = tripTotals(trip);
  const { saved, monthly } = trip.savings;
  const remaining = subtract(total, saved);
  const left = remaining.amountMinor > 0n ? remaining : zero(trip.currency);
  const status: SavingsStatus = isZero(total)
    ? 'no-costs'
    : isZero(left)
      ? 'fully-saved'
      : 'saving';

  const progressBasisPoints = isZero(total)
    ? 0
    : Number(
        saved.amountMinor <= 0n
          ? 0n
          : compare(saved, total) >= 0
            ? 10_000n
            : (saved.amountMinor * 10_000n) / total.amountMinor,
      );

  let monthsNeeded: number | null = null;
  if (status !== 'saving') monthsNeeded = 0;
  else if (monthly.amountMinor > 0n)
    monthsNeeded = Number(ceilDiv(left.amountMinor, monthly.amountMinor));
  const readyMonth = monthsNeeded === null ? null : addMonths(yearMonthOf(today), monthsNeeded);

  const departure = trip.startDate;
  const departed = departure !== null && compareLocalDates(departure, today) <= 0;
  const monthsUntilDeparture = departure === null ? null : fullMonthsBetween(today, departure);

  let monthlyNeeded: Money | null = null;
  if (monthsUntilDeparture !== null && status === 'saving') {
    monthlyNeeded =
      monthsUntilDeparture === 0
        ? left
        : roundUpFriendly(
            money(ceilDiv(left.amountMinor, BigInt(monthsUntilDeparture)), trip.currency),
          );
  }

  let onTime: boolean | null = null;
  if (monthsUntilDeparture !== null) {
    onTime = monthsNeeded !== null && monthsNeeded <= monthsUntilDeparture;
  }

  return {
    status,
    total,
    saved,
    left,
    progressBasisPoints,
    monthsNeeded,
    readyMonth,
    departure,
    departed,
    monthsUntilDeparture,
    monthlyNeeded,
    onTime,
  };
}
