/**
 * Plans, the free trial and Pip credits (docs/product/business-rules.md#plans-trial-and-pip-credits, ADR-0019).
 * Prices are USD minor units; payment itself is Stripe's job, these rules only say what an account may do.
 */

export const PAID_PLANS = ['explorer', 'voyager'] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export type BillingInterval = 'month' | 'year';
export const BILLING_INTERVALS: readonly BillingInterval[] = ['month', 'year'];

export interface PlanTerms {
  readonly monthlyMinor: bigint;
  readonly annualMinor: bigint;
  /** Pip requests per month (annual plans get them monthly too). */
  readonly credits: number;
  /** Trips that are not archived; null for no limit. */
  readonly maxActiveTrips: number | null;
}

export const PLAN_TERMS: Readonly<Record<PaidPlan, PlanTerms>> = {
  explorer: { monthlyMinor: 499n, annualMinor: 3999n, credits: 100, maxActiveTrips: 10 },
  voyager: { monthlyMinor: 999n, annualMinor: 7999n, credits: 400, maxActiveTrips: null },
};

export const TRIAL_TERMS = { days: 7, credits: 15, maxActiveTrips: 10 } as const;

/** Extra credits bought once; they never expire and are spent after the monthly ones. */
export const TOP_UP = { credits: 200, priceMinor: 299n } as const;

/** Pip requests a day, whatever the balance: a guard against runaway use. */
export const PIP_DAILY_CAP = 40;

/** Days a failed renewal keeps the plan before the account turns read-only. */
export const PAYMENT_GRACE_DAYS = 3;

export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionState {
  readonly plan: PaidPlan;
  readonly interval: BillingInterval;
  readonly status: SubscriptionStatus;
  /** When the subscription began: monthly credit periods count from here. */
  readonly startedAt: Date;
  /** The end of what has been paid for. */
  readonly currentPeriodEnd: Date;
}

export type AccessLevel = 'trial' | PaidPlan | 'expired';

export interface Entitlements {
  readonly access: AccessLevel;
  /** True once the trial is over with no plan: everything can be seen and exported, nothing changed. */
  readonly readOnly: boolean;
  readonly trialEndsAt: Date;
  readonly maxActiveTrips: number | null;
  /** Monthly (or trial) Pip credits and the window they belong to. */
  readonly credits: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  /** The paid plan, kept when it has lapsed so the page can offer it again. */
  readonly plan: PaidPlan | null;
  readonly interval: BillingInterval | null;
  readonly renewsAt: Date | null;
  readonly status: SubscriptionStatus | null;
}

const DAY_MS = 86_400_000;

/** `date` plus whole calendar months, in UTC, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

/** The monthly window around `now` that started on the same day of the month as `startedAt`. */
export function monthlyWindow(startedAt: Date, now: Date): { start: Date; end: Date } {
  let months =
    (now.getUTCFullYear() - startedAt.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - startedAt.getUTCMonth());
  if (addMonthsUtc(startedAt, months) > now) months -= 1;
  months = Math.max(0, months);
  return { start: addMonthsUtc(startedAt, months), end: addMonthsUtc(startedAt, months + 1) };
}

/** Whether a subscription still grants its plan at `now` (paid up, or inside the grace after a failed renewal). */
export function subscriptionGrants(subscription: SubscriptionState, now: Date): boolean {
  const end = subscription.currentPeriodEnd.getTime();
  if (subscription.status === 'past_due') return now.getTime() < end + PAYMENT_GRACE_DAYS * DAY_MS;
  // A canceled subscription runs to the end of what was paid for.
  return now.getTime() < end;
}

export function entitlements(input: {
  readonly signedUpAt: Date;
  readonly subscription: SubscriptionState | null;
  readonly now: Date;
}): Entitlements {
  const { signedUpAt, subscription, now } = input;
  const trialEndsAt = new Date(signedUpAt.getTime() + TRIAL_TERMS.days * DAY_MS);
  const paidFacts = {
    plan: subscription?.plan ?? null,
    interval: subscription?.interval ?? null,
    renewsAt:
      subscription && subscription.status === 'active' ? subscription.currentPeriodEnd : null,
    status: subscription?.status ?? null,
  };
  if (subscription && subscriptionGrants(subscription, now)) {
    const terms = PLAN_TERMS[subscription.plan];
    const window = monthlyWindow(subscription.startedAt, now);
    return {
      access: subscription.plan,
      readOnly: false,
      trialEndsAt,
      maxActiveTrips: terms.maxActiveTrips,
      credits: terms.credits,
      periodStart: window.start,
      periodEnd: window.end,
      ...paidFacts,
    };
  }
  const inTrial = now < trialEndsAt;
  return {
    access: inTrial ? 'trial' : 'expired',
    readOnly: !inTrial,
    trialEndsAt,
    maxActiveTrips: TRIAL_TERMS.maxActiveTrips,
    credits: inTrial ? TRIAL_TERMS.credits : 0,
    periodStart: signedUpAt,
    periodEnd: trialEndsAt,
    ...paidFacts,
  };
}

export interface CreditBalance {
  /** Monthly (or trial) credits not used yet in this window. */
  readonly monthlyLeft: number;
  /** Bought credits left. */
  readonly topUpLeft: number;
  readonly total: number;
  /** Which pot the next request is paid from, or null when both are empty. */
  readonly next: 'monthly' | 'top-up' | null;
}

/** Monthly credits go first; bought credits only once those are spent. Read-only accounts cannot spend any. */
export function creditBalance(input: {
  readonly entitlements: Entitlements;
  readonly usedInPeriod: number;
  readonly topUpBalance: number;
}): CreditBalance {
  const { entitlements: rights, usedInPeriod, topUpBalance } = input;
  const monthlyLeft = Math.max(0, rights.credits - usedInPeriod);
  const topUpLeft = Math.max(0, topUpBalance);
  const next = rights.readOnly
    ? null
    : monthlyLeft > 0
      ? 'monthly'
      : topUpLeft > 0
        ? 'top-up'
        : null;
  return { monthlyLeft, topUpLeft, total: monthlyLeft + topUpLeft, next };
}

/** Whole days left in the trial, counting a started day as one; 0 once it is over. */
export function trialDaysLeft(trialEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

/** The "free week ends soon" email goes this many hours before the end. */
export const TRIAL_ENDING_NOTICE_HOURS = 48;
/** The "free week is over" email is sent only this many days after the end (older accounts are not written to). */
export const TRIAL_ENDED_NOTICE_DAYS = 3;
