import {
  add,
  convert,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  exchangeRate,
  fromDecimal,
  guessRemainder,
  money,
  MoneyError,
  savingsPlan,
  subtract,
  toDecimalString,
  tripTotals,
  zero,
  toLocalDate,
  type ExpenseCategory,
  type ExpenseStatus,
  type Money,
  type TripPlan,
} from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { NotFoundError, ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { ExpenseRecord, Ports, SavingsRecord, TripRecord } from '../ports';
import { loadOwnedTrip } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import {
  budgetSchema,
  expenseCreateFields,
  expenseFields,
  expenseListSchema,
  expenseSchema,
  savingsFields,
  type ExpenseView,
} from './schemas';

const view = (value: Money) => ({ amount: toDecimalString(value), currency: value.currency });

function invalid(field: string, message: string): never {
  throw new ValidationError([{ field, code: 'custom', message }]);
}

/** A decimal in major units to money, or a field error: too many decimals for the currency, and so on. */
function parseMoney(amount: string, currency: string, field: string): Money {
  try {
    return fromDecimal(amount, currency);
  } catch (error) {
    if (error instanceof MoneyError) invalid(field, error.message);
    throw error;
  }
}

export function toExpenseView(record: ExpenseRecord, tripCurrency: string): ExpenseView {
  return {
    id: record.id,
    description: record.description,
    category: record.category as ExpenseCategory,
    status: record.status as ExpenseStatus,
    original: view(money(record.amountMinor, record.currency)),
    inTripCurrency: view(money(record.tripAmountMinor, tripCurrency)),
    fx:
      record.fxRate === null || record.fxSource === null || record.fxAsOf === null
        ? null
        : { rate: record.fxRate, source: record.fxSource, asOf: record.fxAsOf },
    guess: record.guess,
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * The trip's rough guess and what it still counts for: the guess minus every other cost, never below zero
 * (business rules, "the first trip"). Null without a guess.
 */
function guessOf(expenses: readonly ExpenseRecord[], currency: string) {
  const record = expenses.find((expense) => expense.guess);
  if (!record) return null;
  const others = expenses
    .filter((expense) => !expense.guess)
    .reduce((sum, expense) => add(sum, money(expense.tripAmountMinor, currency)), zero(currency));
  const amount = money(record.tripAmountMinor, currency);
  return { record, amount, counted: guessRemainder(amount, others) };
}

/**
 * What an expense stores from what was typed: the amount as typed, and the same cost in the trip's currency with the
 * provenance of the rate. The converted amount is always computed here, never taken from the client.
 */
function priceExpense(fields: z.output<typeof expenseFields>, tripCurrency: string, today: Date) {
  const original = parseMoney(fields.amount, fields.currency, 'amount');
  if (fields.currency === tripCurrency) {
    if (fields.fxRate) invalid('fxRate', 'No rate is needed: the cost is in the trip’s currency');
    return {
      amountMinor: original.amountMinor,
      tripAmountMinor: original.amountMinor,
      fxRate: null,
      fxSource: null,
      fxAsOf: null,
    };
  }
  if (!fields.fxRate)
    invalid('fxRate', `Give the rate to ${tripCurrency}: the cost is in ${fields.currency}`);
  const asOf = fields.fxAsOf ?? today.toISOString().slice(0, 10);
  let converted: Money;
  try {
    const rate = exchangeRate({
      id: 'manual',
      base: fields.currency,
      quote: tripCurrency,
      rate: fields.fxRate,
      source: 'manual',
      asOf: new Date(`${asOf}T00:00:00Z`),
    });
    converted = convert(original, rate).converted;
  } catch (error) {
    if (error instanceof MoneyError) invalid('fxRate', error.message);
    throw error;
  }
  // A cost too small to be worth one minor unit in the trip's currency would store as zero: refuse it.
  if (converted.amountMinor <= 0n)
    invalid('amount', 'That amount is worth less than the smallest unit of the trip’s currency');
  return {
    amountMinor: original.amountMinor,
    tripAmountMinor: converted.amountMinor,
    fxRate: fields.fxRate,
    fxSource: 'manual',
    fxAsOf: asOf,
  };
}

/** The domain's view of a trip. The budget needs only costs and savings; readiness also reads stops and lists. */
export function planOf(
  trip: TripRecord,
  expenses: readonly ExpenseRecord[],
  savings: SavingsRecord | null,
  extra: { stops?: TripPlan['stops']; checklist?: TripPlan['checklist'] } = {},
): TripPlan {
  const guess = guessOf(expenses, trip.currency);
  return {
    currency: toCurrency(trip.currency),
    startDate: trip.startDate === null ? null : toLocalDate(trip.startDate),
    stops: extra.stops ?? [],
    // Totals count the rough guess only for what the real costs have not covered yet.
    expenses: expenses.flatMap((record) => {
      const amount = record.guess
        ? (guess?.counted ?? zero(trip.currency))
        : money(record.tripAmountMinor, trip.currency);
      if (amount.amountMinor === 0n) return [];
      return [
        {
          id: record.id,
          category: record.category as ExpenseCategory,
          stopId: null,
          status: record.status as ExpenseStatus,
          amount,
        },
      ];
    }),
    checklist: extra.checklist ?? [],
    savings: {
      saved: money(savings?.savedMinor ?? 0n, trip.currency),
      monthly: money(savings?.monthlyMinor ?? 0n, trip.currency),
    },
  };
}
const toCurrency = (code: string) => zero(code).currency;

/** The budget of a trip: totals, and "can I afford it, and when?" from the savings plan rule. */
export function budgetOf(
  trip: TripRecord,
  expenses: readonly ExpenseRecord[],
  savings: SavingsRecord | null,
  today: Date,
) {
  const plan = planOf(trip, expenses, savings);
  const totals = tripTotals(plan);
  const sp = savingsPlan(plan, toLocalDate(today.toISOString().slice(0, 10)));
  const ceiling =
    savings?.ceilingMinor === null || savings?.ceilingMinor === undefined
      ? null
      : money(savings.ceilingMinor, trip.currency);
  const guess = guessOf(expenses, trip.currency);
  return {
    currency: trip.currency,
    total: view(totals.total),
    guess: guess ? { amount: view(guess.amount), counted: view(guess.counted) } : null,
    byCategory: EXPENSE_CATEGORIES.map((category) => ({
      category,
      amount: view(totals.byCategory[category]),
    })),
    byStatus: EXPENSE_STATUSES.map((status) => ({ status, amount: view(totals.byStatus[status]) })),
    savings: {
      status: sp.status,
      saved: view(sp.saved),
      monthly: view(plan.savings.monthly),
      left: view(sp.left),
      progressBasisPoints: sp.progressBasisPoints,
      monthsNeeded: sp.monthsNeeded,
      readyMonth: sp.readyMonth,
      departure: sp.departure,
      departed: sp.departed,
      monthsUntilDeparture: sp.monthsUntilDeparture,
      monthlyNeeded: sp.monthlyNeeded === null ? null : view(sp.monthlyNeeded),
      onTime: sp.onTime,
      ceiling: ceiling === null ? null : view(ceiling),
      ceilingSlack: ceiling === null ? null : view(subtract(ceiling, totals.total)),
    },
  };
}

type Reads = Pick<Ports, 'trips' | 'expenses' | 'savings' | 'clock'>;

export function createGetBudget(deps: Reads) {
  return defineOperation({
    name: 'getBudget',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: budgetSchema,
    async handler(actor, input) {
      const trip = await loadOwnedTrip(deps.trips, actor, input.tripId);
      const [expenses, savings] = await Promise.all([
        deps.expenses.listByTrip(trip.id),
        deps.savings.find(trip.id),
      ]);
      return budgetOf(trip, expenses, savings, deps.clock.now());
    },
  });
}

export function createListExpenses(deps: Pick<Ports, 'trips' | 'expenses'>) {
  return defineOperation({
    name: 'listExpenses',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: expenseListSchema,
    async handler(actor, input) {
      const trip = await loadOwnedTrip(deps.trips, actor, input.tripId);
      const records = await deps.expenses.listByTrip(trip.id);
      return { expenses: records.map((record) => toExpenseView(record, trip.currency)) };
    },
  });
}

type Writes = Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>;

export function createCreateExpense(deps: Writes) {
  return defineOperation({
    name: 'createExpense',
    kind: 'command',
    input: expenseCreateFields.extend({ tripId: tripIdSchema }),
    output: expenseSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        const priced = priceExpense(input, trip.currency, now);
        const guess = input.guess === true;
        if (guess && (await tx.expenses.listByTrip(trip.id)).some((expense) => expense.guess)) {
          invalid('guess', 'This trip already has a rough guess');
        }
        const record = await tx.expenses.insert({
          id: deps.ids.newId(),
          tripId: trip.id,
          category: input.category,
          status: input.status,
          description: input.description,
          currency: input.currency,
          guess,
          createdAt: now,
          ...priced,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'expense.create',
          entityType: 'trip',
          entityId: trip.id,
          // The category and the status are fixed words; amounts and descriptions are personal and stay out.
          metadata: { category: input.category, status: input.status },
        });
        return toExpenseView(record, trip.currency);
      });
    },
  });
}

/** A cost of another trip, or one that is missing, is the same "not found". */
async function loadOwnedExpense(
  tx: Pick<Ports, 'expenses'>,
  tripId: string,
  expenseId: string,
): Promise<ExpenseRecord> {
  const record = await tx.expenses.findById(expenseId);
  if (!record || record.tripId !== tripId) throw new NotFoundError();
  return record;
}

export function createUpdateExpense(deps: Writes) {
  return defineOperation({
    name: 'updateExpense',
    kind: 'command',
    input: expenseFields.extend({ tripId: tripIdSchema, expenseId: z.uuid() }),
    output: expenseSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        await loadOwnedExpense(tx, trip.id, input.expenseId);
        const priced = priceExpense(input, trip.currency, now);
        const record = await tx.expenses.update(
          input.expenseId,
          {
            category: input.category,
            status: input.status,
            description: input.description,
            currency: input.currency,
            ...priced,
          },
          now,
        );
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'expense.update',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { category: input.category, status: input.status },
        });
        return toExpenseView(record, trip.currency);
      });
    },
  });
}

export function createDeleteExpense(deps: Writes) {
  return defineOperation({
    name: 'deleteExpense',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, expenseId: z.uuid() }),
    output: z.object({}),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        await loadOwnedExpense(tx, trip.id, input.expenseId);
        await tx.expenses.delete(input.expenseId);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'expense.delete',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return {};
      });
    },
  });
}

export function createUpdateSavings(deps: Writes) {
  return defineOperation({
    name: 'updateSavings',
    kind: 'command',
    input: savingsFields
      .extend({ tripId: tripIdSchema })
      .refine(
        (value) =>
          value.saved !== undefined || value.monthly !== undefined || value.ceiling !== undefined,
        {
          error: 'Provide at least one field to change',
        },
      ),
    output: budgetSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        const savings = await tx.savings.upsert(
          trip.id,
          {
            savedMinor:
              input.saved === undefined
                ? undefined
                : parseMoney(input.saved, trip.currency, 'saved').amountMinor,
            monthlyMinor:
              input.monthly === undefined
                ? undefined
                : parseMoney(input.monthly, trip.currency, 'monthly').amountMinor,
            ceilingMinor:
              input.ceiling === undefined
                ? undefined
                : input.ceiling === null
                  ? null
                  : parseMoney(input.ceiling, trip.currency, 'ceiling').amountMinor,
          },
          now,
        );
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'savings.update',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {
            fields: [
              input.saved === undefined ? '' : 'saved',
              input.monthly === undefined ? '' : 'monthly',
              input.ceiling === undefined ? '' : 'ceiling',
            ].filter(Boolean),
          },
        });
        const expenses = await tx.expenses.listByTrip(trip.id);
        return budgetOf(trip, expenses, savings, now);
      });
    },
  });
}

export type { Actor };
