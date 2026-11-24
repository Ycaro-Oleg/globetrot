import { add, subtract, zero, type Money } from '../money';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  type ExpenseCategory,
  type ExpenseStatus,
  type TripPlan,
} from './types';

export interface TripTotals {
  readonly total: Money;
  /** Every category is present (zero when unused), in `EXPENSE_CATEGORIES` order. */
  readonly byCategory: Readonly<Record<ExpenseCategory, Money>>;
  readonly byStatus: Readonly<Record<ExpenseStatus, Money>>;
  /** Only stops that have at least one expense. */
  readonly byStop: ReadonlyMap<string, Money>;
  /** Expenses that belong to the whole trip (no stop). */
  readonly tripWide: Money;
}

/**
 * Totals by category, status and stop, in the trip currency.
 * An expense in another currency throws `CurrencyMismatchError`: convert before deriving.
 */
export function tripTotals(trip: TripPlan): TripTotals {
  const empty = zero(trip.currency);
  const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, empty])) as Record<
    ExpenseCategory,
    Money
  >;
  const byStatus = Object.fromEntries(EXPENSE_STATUSES.map((s) => [s, empty])) as Record<
    ExpenseStatus,
    Money
  >;
  const byStop = new Map<string, Money>();
  let total = empty;
  let tripWide = empty;

  for (const e of trip.expenses) {
    total = add(total, e.amount);
    byCategory[e.category] = add(byCategory[e.category], e.amount);
    byStatus[e.status] = add(byStatus[e.status], e.amount);
    if (e.stopId === null) tripWide = add(tripWide, e.amount);
    else byStop.set(e.stopId, add(byStop.get(e.stopId) ?? empty, e.amount));
  }

  return { total, byCategory, byStatus, byStop, tripWide };
}

/**
 * What the onboarding's rough guess still counts for: it stands for the rest of the trip, so the real costs come out
 * of it instead of adding on top. `others` is every other cost of the trip; the result is never below zero.
 * Both amounts must be in the same currency (the trip's).
 */
export function guessRemainder(guess: Money, others: Money): Money {
  const left = subtract(guess, others);
  return left.amountMinor > 0n ? left : zero(guess.currency);
}
