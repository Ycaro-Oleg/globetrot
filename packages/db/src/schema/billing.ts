// Plans and Pip credits (ADR-0019). The subscription mirrors what the payment provider says; credits bought
// once are a ledger, so a webhook delivered twice adds nothing twice (`ref` is unique).
import { BILLING_INTERVALS, PAID_PLANS, SUBSCRIPTION_STATUSES } from '@globetrot/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';

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
