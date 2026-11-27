// A trip's money: its expenses and its savings. Conventions: docs/architecture/data-model.md and money.md.
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, MILES_PROGRAMS } from '@globetrot/domain';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
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
    /**
     * The onboarding's rough guess for the whole trip. It stands for the rest of the trip: totals count it minus every
     * other cost, never below zero. At most one per trip.
     */
    guess: boolean('guess').default(false).notNull(),
    /** Who paid it, on a trip planned together (ADR-0025); null when nobody said. Kept null if they leave. */
    paidBy: text('paid_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('expense_trip_id_created_at_idx').on(table.tripId, table.createdAt),
    uniqueIndex('expense_one_guess_per_trip')
      .on(table.tripId)
      .where(sql`${table.guess}`),
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

/**
 * Each person's money on a trip planned together (ADR-0025): their part of the cost (basis points, null for an
 * equal split), what they have set aside and what they put aside each month, in the trip's currency. The owner
 * may have a row too.
 */
export const tripPersonMoney = pgTable(
  'trip_person_money',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    shareBp: integer('share_bp'),
    savedMinor: minor('saved_minor')
      .notNull()
      .default(sql`0`),
    monthlyMinor: minor('monthly_minor')
      .notNull()
      .default(sql`0`),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId] }),
    check(
      'trip_person_money_share_range',
      sql`${table.shareBp} is null or ${table.shareBp} between 0 and 10000`,
    ),
    check(
      'trip_person_money_amounts',
      sql`${table.savedMinor} >= 0 and ${table.monthlyMinor} >= 0`,
    ),
  ],
);

/**
 * The weekly saving check-in (ADR-0026): what a person set aside in an ISO week (`2027-W05`) for a trip. One per
 * person, trip and week; checking in again that week changes the amount.
 */
export const savingsCheckin = pgTable(
  'savings_checkin',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    week: text('week').notNull(),
    amountMinor: minor('amount_minor').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId, table.week] }),
    index('savings_checkin_user_idx').on(table.userId, table.week),
    check('savings_checkin_week_format', sql`${table.week} ~ '^[0-9]{4}-W[0-9]{2}$'`),
    check('savings_checkin_amount', sql`${table.amountMinor} >= 0`),
  ],
);

/** Weekly reminder emails already sent, one per person and ISO week, so the worker never sends one twice. */
export const weeklyNotice = pgTable(
  'weekly_notice',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    week: text('week').notNull(),
    sentAt: instant('sent_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.week] })],
);

/** A person's miles in each Brazilian loyalty programme (ADR-0030); a zero balance is not kept. */
export const milesBalance = pgTable(
  'miles_balance',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    program: text('program').notNull(),
    balance: integer('balance').notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.program] }),
    check('miles_balance_program_valid', oneOf(table.program, MILES_PROGRAMS)),
    check('miles_balance_positive', sql`${table.balance} > 0`),
  ],
);

/** How many of their miles a person chose to put towards a trip, per programme. */
export const tripMiles = pgTable(
  'trip_miles',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    program: text('program').notNull(),
    miles: integer('miles').notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId, table.program] }),
    check('trip_miles_program_valid', oneOf(table.program, MILES_PROGRAMS)),
    check('trip_miles_positive', sql`${table.miles} > 0`),
  ],
);
