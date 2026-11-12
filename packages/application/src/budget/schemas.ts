import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '@globetrot/domain';
import { z } from 'zod';
import { currencySchema, dateSchema } from '../trips/schemas';

/** A plain positive decimal in major units ("12.50"). Precision per currency is checked when it is used. */
const decimal = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,8})?$/, { error: 'Use a plain number such as 12.50' });

export const amountSchema = decimal
  .refine((value) => /[1-9]/.test(value), { error: 'The amount must be more than zero' })
  .meta({ description: 'Major units as a decimal string.', example: '1250.00' });

/** Zero or more, for savings. */
export const nonNegativeAmountSchema = decimal.meta({
  description: 'Major units as a decimal string, zero allowed.',
  example: '300.00',
});

export const expenseFields = z.object({
  description: z.string().trim().min(1).max(120).meta({ example: 'Flights to Tokyo' }),
  category: z.enum(EXPENSE_CATEGORIES),
  status: z
    .enum(EXPENSE_STATUSES)
    .meta({ description: 'estimate (≈), confirmed (✓), paid (●) or unknown (?).' }),
  amount: amountSchema,
  currency: currencySchema,
  fxRate: decimal
    .refine((value) => /[1-9]/.test(value), { error: 'The rate must be more than zero' })
    .nullable()
    .optional()
    .meta({
      description:
        'Required when `currency` is not the trip’s: how much of the trip’s currency 1 unit of `currency` is worth.',
      example: '0.0065',
    }),
  fxAsOf: dateSchema
    .nullable()
    .optional()
    .meta({ description: 'The day the rate was taken. Defaults to today.' }),
});

export const moneySchema = z.object({
  amount: z.string().meta({ description: 'Major units, exact.', example: '1250.00' }),
  currency: z.string(),
});

export const expenseSchema = z.object({
  id: z.uuid(),
  description: z.string(),
  category: z.enum(EXPENSE_CATEGORIES),
  status: z.enum(EXPENSE_STATUSES),
  /** What was typed. */
  original: moneySchema,
  /** The same cost in the trip's currency. */
  inTripCurrency: moneySchema,
  /** Provenance of the conversion, or null when the cost was in the trip's own currency. */
  fx: z.object({ rate: z.string(), source: z.string(), asOf: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
});
export type ExpenseView = z.infer<typeof expenseSchema>;

export const expenseListSchema = z.object({ expenses: z.array(expenseSchema) });

export const savingsFields = z.object({
  saved: nonNegativeAmountSchema
    .optional()
    .meta({ description: 'Already set aside, in the trip’s currency.' }),
  monthly: nonNegativeAmountSchema
    .optional()
    .meta({ description: 'Planned monthly amount, in the trip’s currency.' }),
});

export const budgetSchema = z.object({
  currency: z.string(),
  total: moneySchema,
  byCategory: z.array(z.object({ category: z.enum(EXPENSE_CATEGORIES), amount: moneySchema })),
  byStatus: z.array(z.object({ status: z.enum(EXPENSE_STATUSES), amount: moneySchema })),
  savings: z.object({
    status: z.enum(['no-costs', 'fully-saved', 'saving']),
    saved: moneySchema,
    monthly: moneySchema,
    left: moneySchema,
    /** 0 to 10 000. */
    progressBasisPoints: z.number().int(),
    monthsNeeded: z.number().int().nullable(),
    /** `YYYY-MM`, when the goal is reached at the current monthly amount. */
    readyMonth: z.string().nullable(),
    departure: z.string().nullable(),
    departed: z.boolean(),
    monthsUntilDeparture: z.number().int().nullable(),
    monthlyNeeded: moneySchema.nullable(),
    onTime: z.boolean().nullable(),
  }),
});
export type BudgetView = z.infer<typeof budgetSchema>;
