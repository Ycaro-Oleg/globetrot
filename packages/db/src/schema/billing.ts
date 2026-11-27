// Plans and Pip credits (ADR-0019). The subscription mirrors what the payment provider says; credits bought
// once are a ledger, so a webhook delivered twice adds nothing twice (`ref` is unique).
import { BILLING_INTERVALS, PAID_PLANS, SUBSCRIPTION_STATUSES } from '@globetrot/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trip';

const instant = (name: string) => timestamp(name, { withTimezone: true });
const list = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

/** One per account at most: the paid plan, absent during the trial. */
export const subscription = pgTable(
  'subscription',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    plan: text('plan').notNull(),
    interval: text('interval').notNull(),
    status: text('status').notNull(),
    startedAt: instant('started_at').notNull(),
    currentPeriodEnd: instant('current_period_end').notNull(),
    /** The provider's ids, to match webhooks. Not personal data, never shown. */
    providerCustomerId: text('provider_customer_id'),
    providerSubscriptionId: text('provider_subscription_id').unique(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check('subscription_plan_valid', sql`${table.plan} in (${list(PAID_PLANS)})`),
    check('subscription_interval_valid', sql`${table.interval} in (${list(BILLING_INTERVALS)})`),
    check('subscription_status_valid', sql`${table.status} in (${list(SUBSCRIPTION_STATUSES)})`),
  ],
);

/** Bought credits in (+), credits spent from them out (-). Monthly credits are not here: they come from the plan. */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    /** What caused it (a payment id for a top-up), unique so it is applied once. */
    ref: text('ref').unique(),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('credit_ledger_user_id_idx').on(table.userId, table.createdAt),
    check('credit_ledger_reason_valid', sql`${table.reason} in ('top-up', 'pip', 'grant')`),
    check('credit_ledger_delta_nonzero', sql`${table.delta} <> 0`),
  ],
);

/** One-time account emails already sent (the trial reminders), so the worker never sends one twice. */
export const accountNotice = pgTable(
  'account_notice',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    sentAt: instant('sent_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind] }),
    check('account_notice_kind_valid', sql`${table.kind} in ('trial-ending', 'trial-ended')`),
  ],
);

/**
 * A trip pass (ADR-0023): one payment that unlocks the paid tools on one trip until `valid_until`. Granted from
 * the payment provider's webhook; `provider_ref` (the payment) is unique, so a repeated delivery grants nothing.
 */
export const tripPass = pgTable(
  'trip_pass',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    purchasedAt: instant('purchased_at').notNull(),
    validUntil: instant('valid_until').notNull(),
    providerRef: text('provider_ref').notNull().unique(),
  },
  (table) => [index('trip_pass_user_id_idx').on(table.userId)],
);

/** Each account's referral code (ADR-0029), made the first time the person asks for their link. */
export const referralCode = pgTable('referral_code', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  createdAt: instant('created_at').defaultNow().notNull(),
});

/** Who came through whose link: one referrer per account, rewarded once, when the friend first pays. */
export const referral = pgTable('referral', {
  referredUserId: text('referred_user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  referrerUserId: text('referrer_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: instant('created_at').defaultNow().notNull(),
  rewardedAt: instant('rewarded_at'),
});

/**
 * A free trip pass to use on any trip (ADR-0029): earned when a referred friend first pays. `ref` is unique, so a
 * reward is granted once; using it records the trip.
 */
export const passCredit = pgTable(
  'pass_credit',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    ref: text('ref').notNull().unique(),
    createdAt: instant('created_at').defaultNow().notNull(),
    usedTripId: uuid('used_trip_id').references(() => trip.id, { onDelete: 'set null' }),
    usedAt: instant('used_at'),
  },
  (table) => [
    index('pass_credit_user_idx').on(table.userId),
    check('pass_credit_reason_valid', sql`${table.reason} in ('referral')`),
  ],
);
