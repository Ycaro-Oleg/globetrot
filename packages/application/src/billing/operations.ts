import {
  BILLING_INTERVALS,
  creditBalance,
  PAID_PLANS,
  PIP_DAILY_CAP,
  PRICE_CURRENCIES,
  priceCurrencyFor,
  SUBSCRIPTION_STATUSES,
  trialDaysLeft,
} from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { NotFoundError, UnavailableError } from '../errors';
import { defineOperation, type Operation } from '../operation';
import type { Ports } from '../ports';
import { assertCanChange, OPEN_WHEN_READ_ONLY, tripCount } from './rules';

export const billingSchema = z.object({
  access: z.enum(['trial', 'explorer', 'voyager', 'free']),
  /** More counted trips than the plan keeps: changes wait until some are archived, passed or a plan is chosen. */
  overLimit: z.boolean(),
  /** The currency prices are shown in: BRL when the person chose reais, else USD (ADR-0023). */
  priceCurrency: z.enum(PRICE_CURRENCIES),
  /** Trips with a pass that still holds, and until when. */
  passes: z.array(z.object({ tripId: z.string(), validUntil: z.string() })),
  trialEndsAt: z.string(),
  trialDaysLeft: z.number().int(),
  plan: z.enum(PAID_PLANS).nullable(),
  interval: z.enum(BILLING_INTERVALS as [string, ...string[]]).nullable(),
  status: z.enum(SUBSCRIPTION_STATUSES).nullable(),
  renewsAt: z.string().nullable(),
  maxActiveTrips: z.number().int().nullable(),
  activeTrips: z.number().int(),
  /** Active trips without a pass: the ones the plan's limit counts. */
  countedTrips: z.number().int(),
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
export function createGetBilling(
  deps: Pick<Ports, 'billing' | 'trips' | 'assistant' | 'preferences' | 'clock'>,
) {
  return defineOperation({
    name: 'getBilling',
    kind: 'query',
    input: z.object({}),
    output: billingSchema,
    async handler(actor) {
      const now = deps.clock.now();
      const count = await tripCount(deps, actor, now);
      const { rights, passed } = count;
      const [used, account, preferences] = await Promise.all([
        deps.assistant.countRequestsSince(actor.userId, rights.periodStart),
        deps.billing.findAccount(actor.userId),
        deps.preferences.find(actor.userId),
      ]);
      const balance = creditBalance({
        entitlements: rights,
        usedInPeriod: used,
        topUpBalance: account?.topUpBalance ?? 0,
      });
      return {
        access: rights.access,
        overLimit: count.over,
        priceCurrency: priceCurrencyFor(preferences?.currency),
        passes: (account?.passes ?? [])
          .filter((pass) => passed.has(pass.tripId) && pass.validUntil > now)
          .map((pass) => ({ tripId: pass.tripId, validUntil: pass.validUntil.toISOString() })),
        trialEndsAt: rights.trialEndsAt.toISOString(),
        trialDaysLeft: trialDaysLeft(rights.trialEndsAt, now),
        plan: rights.plan,
        interval: rights.interval,
        status: rights.status,
        renewsAt: rights.renewsAt?.toISOString() ?? null,
        maxActiveTrips: rights.maxActiveTrips,
        activeTrips: count.active,
        countedTrips: count.counted,
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
 * Wraps a command so it runs only while the account holds no more trips than its plan keeps. Queries and the
 * commands in `OPEN_WHEN_READ_ONLY` pass through untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function guardReadOnly<T extends Operation<any, any>>(
  operation: T,
  deps: Pick<Ports, 'billing' | 'trips' | 'clock'>,
): T {
  if (operation.kind !== 'command' || OPEN_WHEN_READ_ONLY.has(operation.name)) return operation;
  return {
    ...operation,
    async execute(actor: Actor, input: unknown) {
      await assertCanChange(deps, actor, deps.clock.now());
      return operation.execute(actor, input);
    },
  };
}

/**
 * A hosted checkout for a plan, extra Pip credits or a trip pass, in the person's price currency. Open even over
 * the trip limit: that is how the account opens again. A pass is only for one's own trip.
 */
export function createStartCheckout(
  deps: Pick<Ports, 'users' | 'payments' | 'preferences' | 'trips'>,
) {
  return defineOperation({
    name: 'startCheckout',
    kind: 'command',
    input: z.object({
      item: z.enum(['explorer', 'voyager', 'top-up', 'trip-pass']),
      interval: z.enum(['month', 'year']).default('month'),
      tripId: z
        .uuid()
        .optional()
        .meta({ description: 'The trip a pass is for (`trip-pass` only).' }),
    }),
    output: z.object({ url: z.string() }),
    async handler(actor, input) {
      const user = await deps.users.findById(actor.userId);
      if (!user) throw new NotFoundError();
      let tripId: string | undefined;
      if (input.item === 'trip-pass') {
        const trip = input.tripId ? await deps.trips.findById(input.tripId) : null;
        if (!trip || trip.ownerId !== actor.userId) throw new NotFoundError();
        tripId = trip.id;
      }
      const preferences = await deps.preferences.find(actor.userId);
      const url = await deps.payments.checkoutUrl({
        userId: actor.userId,
        email: user.email,
        item: input.item,
        interval: input.interval,
        currency: priceCurrencyFor(preferences?.currency),
        ...(tripId ? { tripId } : {}),
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
