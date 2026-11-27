import type { BillingInterval, PaidPlan, SubscriptionStatus } from '@globetrot/domain';
import { eq, sql } from 'drizzle-orm';
import type { Database } from './client';
import { creditLedger, subscription, tripPass, user } from './schema';

/** PostgreSQL adapter for plans, bought credits and trip passes (packages/application/src/ports.ts, ADR-0019, ADR-0023). */

type Executor = Pick<Database, 'select' | 'insert' | 'update'>;

export function createBillingRepository(executor: Executor) {
  return {
    async findAccount(userId: string) {
      const [account] = await executor
        .select({ signedUpAt: user.createdAt })
        .from(user)
        .where(eq(user.id, userId));
      if (!account) return null;
      const [plan] = await executor
        .select()
        .from(subscription)
        .where(eq(subscription.userId, userId));
      const passes = await executor
        .select({ tripId: tripPass.tripId, validUntil: tripPass.validUntil })
        .from(tripPass)
        .where(eq(tripPass.userId, userId));
      const [ledger] = await executor
        .select({ balance: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
        .from(creditLedger)
        .where(eq(creditLedger.userId, userId));
      return {
        signedUpAt: account.signedUpAt,
        subscription: plan
          ? {
              plan: plan.plan as PaidPlan,
              interval: plan.interval as BillingInterval,
              status: plan.status as SubscriptionStatus,
              startedAt: plan.startedAt,
              currentPeriodEnd: plan.currentPeriodEnd,
            }
          : null,
        topUpBalance: Number(ledger?.balance ?? 0),
        passes,
      };
    },
    async findProviderCustomer(userId: string) {
      const [row] = await executor
        .select({ customer: subscription.providerCustomerId })
        .from(subscription)
        .where(eq(subscription.userId, userId));
      return row?.customer ?? null;
    },
    async findUserByProviderSubscription(providerSubscriptionId: string) {
      const [row] = await executor
        .select({ userId: subscription.userId })
        .from(subscription)
        .where(eq(subscription.providerSubscriptionId, providerSubscriptionId));
      return row?.userId ?? null;
    },
    async addCredits(row: {
      readonly id: string;
      readonly userId: string;
      readonly delta: number;
      readonly reason: 'top-up' | 'pip' | 'grant';
      readonly ref: string | null;
      readonly createdAt: Date;
    }) {
      const inserted = await executor
        .insert(creditLedger)
        .values(row)
        .onConflictDoNothing({ target: creditLedger.ref })
        .returning({ id: creditLedger.id });
      return inserted.length > 0;
    },
    async grantTripPass(row: {
      readonly id: string;
      readonly tripId: string;
      readonly userId: string;
      readonly purchasedAt: Date;
      readonly validUntil: Date;
      readonly providerRef: string;
    }) {
      const inserted = await executor
        .insert(tripPass)
        .values(row)
        .onConflictDoNothing({ target: tripPass.providerRef })
        .returning({ id: tripPass.id });
      return inserted.length > 0;
    },
    async saveSubscription(
      userId: string,
      record: {
        readonly plan: PaidPlan;
        readonly interval: BillingInterval;
        readonly status: SubscriptionStatus;
        readonly startedAt: Date;
        readonly currentPeriodEnd: Date;
        readonly providerCustomerId: string | null;
        readonly providerSubscriptionId: string | null;
      },
      updatedAt: Date,
    ) {
      await executor
        .insert(subscription)
        .values({ userId, ...record, updatedAt })
        .onConflictDoUpdate({ target: subscription.userId, set: { ...record, updatedAt } });
    },
  };
}

export type BillingRepository = ReturnType<typeof createBillingRepository>;
