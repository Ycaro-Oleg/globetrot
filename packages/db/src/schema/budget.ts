// A trip's money: its expenses and its savings. Conventions: docs/architecture/data-model.md and money.md.
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from '@globetrot/domain';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { trip } from './trip';

const instant = (name: string) => timestamp(name, { withTimezone: true });
const oneOf = (column: AnyColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', '))})`;
const minor = (name: string) => bigint(name, { mode: 'bigint' });

export const expense = pgTable(
  'expense',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    status: text('status').notNull(),
    description: text('description').notNull(),
    /** What was typed: minor units of `currency`. Always positive. */
    amountMinor: minor('amount_minor').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    /** The same cost in the trip's currency, which is what totals add up. Equals `amount_minor` when the currencies match. */
    tripAmountMinor: minor('trip_amount_minor').notNull(),
    /** Provenance of the conversion (1 `currency` = `fx_rate` trip currency); all three are null for the trip's own currency. */
    fxRate: text('fx_rate'),
    fxSource: text('fx_source'),
    fxAsOf: date('fx_as_of', { mode: 'string' }),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('expense_trip_id_created_at_idx').on(table.tripId, table.createdAt),
    check('expense_category_valid', oneOf(table.category, EXPENSE_CATEGORIES)),
    check('expense_status_valid', oneOf(table.status, EXPENSE_STATUSES)),
    check(
      'expense_description_length',
      sql`${table.description} = btrim(${table.description}) and char_length(${table.description}) between 1 and 120`,
    ),
    check(
      'expense_amount_positive',
      sql`${table.amountMinor} > 0 and ${table.tripAmountMinor} > 0`,
    ),
    check('expense_currency_format', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      'expense_fx_provenance',
      sql`(${table.fxRate} is null and ${table.fxSource} is null and ${table.fxAsOf} is null)
        or (${table.fxRate} ~ '^[0-9]+(\.[0-9]+)?$' and ${table.fxSource} is not null and ${table.fxAsOf} is not null)`,
    ),
  ],
);

/**
 * What a trip has set aside, plans to put aside each month and, optionally, its spending ceiling, in the trip's
 * currency. One row per trip.
 */
export const tripSavings = pgTable(
  'trip_savings',
  {
    tripId: uuid('trip_id')
      .primaryKey()
      .references(() => trip.id, { onDelete: 'cascade' }),
    savedMinor: minor('saved_minor')
      .notNull()
      .default(sql`0`),
    monthlyMinor: minor('monthly_minor')
      .notNull()
      .default(sql`0`),
    /** The most the person wants the trip to cost; `null` while no ceiling is set. */
    ceilingMinor: minor('ceiling_minor'),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'trip_savings_not_negative',
      sql`${table.savedMinor} >= 0 and ${table.monthlyMinor} >= 0`,
    ),
    check(
      'trip_savings_ceiling_not_negative',
      sql`${table.ceilingMinor} is null or ${table.ceilingMinor} >= 0`,
    ),
  ],
);
