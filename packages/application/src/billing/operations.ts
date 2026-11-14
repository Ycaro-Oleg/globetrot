import {
  BILLING_INTERVALS,
  creditBalance,
  PAID_PLANS,
  PIP_DAILY_CAP,
  SUBSCRIPTION_STATUSES,
  trialDaysLeft,
} from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { NotFoundError, UnavailableError } from '../errors';
import { defineOperation, type Operation } from '../operation';
import type { Ports } from '../ports';
import { assertCanChange, loadRights, OPEN_WHEN_READ_ONLY } from './rules';

export const billingSchema = z.object({
  access: z.enum(['trial', 'explorer', 'voyager', 'expired']),
  readOnly: z.boolean(),
  trialEndsAt: z.string(),
  trialDaysLeft: z.number().int(),
  plan: z.enum(PAID_PLANS).nullable(),
  interval: z.enum(BILLING_INTERVALS as [string, ...string[]]).nullable(),
  status: z.enum(SUBSCRIPTION_STATUSES).nullable(),
  renewsAt: z.string().nullable(),
  maxActiveTrips: z.number().int().nullable(),
  activeTrips: z.number().int(),
  credits: z.object({
    monthly: z.number().int(),
    monthlyLeft: z.number().int(),
    topUpLeft: z.number().int(),
    total: z.number().int(),
    periodEnd: z.string(),
    dailyCap: z.number().int(),
  }),
});

/** The account's plan, trial and Pip credits, for the plan page, the banners and Pip. */
export function createGetBilling(deps: Pick<Ports, 'billing' | 'trips' | 'assistant' | 'clock'>) {
  return defineOperation({
    name: 'getBilling',
    kind: 'query',
    input: z.object({}),
    output: billingSchema,
    async handler(actor) {
      const now = deps.clock.now();
      const { account, rights } = await loadRights(deps.billing, actor, now);
      const [used, active] = await Promise.all([
        deps.assistant.countRequestsSince(actor.userId, rights.periodStart),
        deps.trips.listByOwner(actor.userId, { includeArchived: false }),
      ]);
      const balance = creditBalance({
        entitlements: rights,
        usedInPeriod: used,
        topUpBalance: account.topUpBalance,
      });
      return {
        access: rights.access,
        readOnly: rights.readOnly,
        trialEndsAt: rights.trialEndsAt.toISOString(),
        trialDaysLeft: trialDaysLeft(rights.trialEndsAt, now),
        plan: rights.plan,
        interval: rights.interval,
        status: rights.status,
        renewsAt: rights.renewsAt?.toISOString() ?? null,
        maxActiveTrips: rights.maxActiveTrips,
        activeTrips: active.length,
        credits: {
          monthly: rights.credits,
          monthlyLeft: balance.monthlyLeft,
          topUpLeft: balance.topUpLeft,
          total: balance.total,
          periodEnd: rights.periodEnd.toISOString(),
          dailyCap: PIP_DAILY_CAP,
        },
      };
    },
  });
}

/**
 * Wraps a command so it runs only while the account may change things. Queries and the commands in
 * `OPEN_WHEN_READ_ONLY` pass through untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function guardReadOnly<T extends Operation<any, any>>(
  operation: T,
  deps: Pick<Ports, 'billing' | 'clock'>,
): T {
  if (operation.kind !== 'command' || OPEN_WHEN_READ_ONLY.has(operation.name)) return operation;
  return {
    ...operation,
    async execute(actor: Actor, input: unknown) {
      await assertCanChange(deps.billing, actor, deps.clock.now());
      return operation.execute(actor, input);
    },
  };
}

/** A hosted checkout for a plan or extra Pip credits. Open even when read-only: that is how the account opens again. */
export function createStartCheckout(deps: Pick<Ports, 'users' | 'payments'>) {
  return defineOperation({
    name: 'startCheckout',
    kind: 'command',
    input: z.object({
      item: z.enum(['explorer', 'voyager', 'top-up']),
      interval: z.enum(['month', 'year']).default('month'),
    }),
    output: z.object({ url: z.string() }),
    async handler(actor, input) {
      const user = await deps.users.findById(actor.userId);
      if (!user) throw new NotFoundError();
      const url = await deps.payments.checkoutUrl({
        userId: actor.userId,
        email: user.email,
        item: input.item,
        interval: input.interval,
      });
      if (!url) throw new UnavailableError('Payments are not switched on yet');
      return { url };
    },
  });
}

/** The provider's page to manage the plan (card, switch, cancel), once the account has paid. */
export function createOpenBillingPortal(deps: Pick<Ports, 'billing' | 'payments'>) {
  return defineOperation({
    name: 'openBillingPortal',
    kind: 'command',
    input: z.object({}),
    output: z.object({ url: z.string() }),
    async handler(actor) {
      const customer = await deps.billing.findProviderCustomer(actor.userId);
      if (!customer) throw new NotFoundError('There is no payment to manage yet');
      const url = await deps.payments.portalUrl({ providerCustomerId: customer });
      if (!url) throw new UnavailableError('Payments are not switched on yet');
      return { url };
    },
  });
}
