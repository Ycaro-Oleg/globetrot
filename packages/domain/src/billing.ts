/**
 * Plans, the free week, the free plan, trip passes and Pip credits (docs/product/business-rules.md#plans-trial-and-pip-credits,
 * ADR-0019 and ADR-0023). Prices are minor units in USD or BRL; payment itself is Stripe's job, these rules only
 * say what an account may do.
 */

const DAY_MS = 86_400_000;

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

/** The currencies prices are set in. Which one a person sees follows their chosen currency, never their language. */
export const PRICE_CURRENCIES = ['USD', 'BRL'] as const;
export type PriceCurrency = (typeof PRICE_CURRENCIES)[number];

/** Reais for someone who chose reais as their currency; US dollars for everyone else. */
export function priceCurrencyFor(preferredCurrency: string | null | undefined): PriceCurrency {
  return preferredCurrency === 'BRL' ? 'BRL' : 'USD';
}

export interface PlanPrice {
  readonly monthlyMinor: bigint;
  readonly annualMinor: bigint;
}

/** What each plan costs, per price currency (ADR-0023). `PLAN_TERMS` repeats the USD price. */
export const PLAN_PRICES: Readonly<Record<PaidPlan, Readonly<Record<PriceCurrency, PlanPrice>>>> = {
  explorer: {
    USD: { monthlyMinor: 499n, annualMinor: 3999n },
    BRL: { monthlyMinor: 1490n, annualMinor: 11900n },
  },
  voyager: {
    USD: { monthlyMinor: 999n, annualMinor: 7999n },
    BRL: { monthlyMinor: 2990n, annualMinor: 23900n },
  },
};

export const PLAN_TERMS: Readonly<Record<PaidPlan, PlanTerms>> = {
  explorer: { ...PLAN_PRICES.explorer.USD, credits: 100, maxActiveTrips: 10 },
  voyager: { ...PLAN_PRICES.voyager.USD, credits: 400, maxActiveTrips: null },
};

export const TRIAL_TERMS = { days: 7, credits: 15, maxActiveTrips: 10 } as const;

/**
 * Free for good after the free week (ADR-0023): one active trip with every tool, a few Pip credits a month and
 * one person to plan with. Trips with a pass do not count.
 */
export const FREE_TERMS = { credits: 5, maxActiveTrips: 1, guests: 1 } as const;

/** Extra credits bought once; they never expire and are spent after the monthly ones. */
export const TOP_UP = { credits: 200, priceMinor: 299n } as const;
export const TOP_UP_PRICES: Readonly<Record<PriceCurrency, bigint>> = { USD: 299n, BRL: 1490n };

/** The small pack (ADR-0033): a few credits for an impulse buy, same rules as the large one. */
export const TOP_UP_SMALL = {
  credits: 50,
  prices: { USD: 99n, BRL: 490n } as Readonly<Record<PriceCurrency, bigint>>,
} as const;

/**
 * A one-time payment that unlocks the paid tools on one trip (ADR-0023): it does not count towards the free
 * plan's one trip, takes any number of people, and lasts until 30 days after the trip ends, or 12 months from
 * the purchase when the trip has no dates yet. Since ADR-0033 it also adds Pip credits that never expire.
 */
export const TRIP_PASS = {
  prices: { USD: 999n, BRL: 4900n } as Readonly<Record<PriceCurrency, bigint>>,
  credits: 50,
  daysAfterTrip: 30,
  monthsWithoutDates: 12,
} as const;

export interface TripPassState {
  readonly tripId: string;
  readonly validUntil: Date;
}

/** Until when a pass bought at `purchasedAt` lasts, given the trip's last day (if it has dates). */
export function tripPassValidUntil(purchasedAt: Date, tripEndsOn: Date | null): Date {
  const byDates = tripEndsOn
    ? new Date(tripEndsOn.getTime() + (TRIP_PASS.daysAfterTrip + 1) * DAY_MS)
    : null;
  const fallback = addMonthsUtc(purchasedAt, TRIP_PASS.monthsWithoutDates);
  // A pass bought for a trip that already ended still gets its 30 days from the purchase.
  const floor = new Date(purchasedAt.getTime() + TRIP_PASS.daysAfterTrip * DAY_MS);
  if (!byDates) return fallback;
  return byDates > floor ? byDates : floor;
}

/** The trips with a pass that still holds at `now`. */
export function passedTripIds(passes: readonly TripPassState[], now: Date): Set<string> {
  return new Set(passes.filter((pass) => pass.validUntil > now).map((pass) => pass.tripId));
}

/** Pip requests a day, whatever the balance: a guard against runaway use. */
export const PIP_DAILY_CAP = 40;

/** Days a failed renewal keeps the plan before the account moves to the free plan. */
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

export type AccessLevel = 'trial' | PaidPlan | 'free';

export interface Entitlements {
  readonly access: AccessLevel;
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
      trialEndsAt,
      maxActiveTrips: terms.maxActiveTrips,
      credits: terms.credits,
      periodStart: window.start,
      periodEnd: window.end,
      ...paidFacts,
    };
  }
  if (now < trialEndsAt) {
    return {
      access: 'trial',
      trialEndsAt,
      maxActiveTrips: TRIAL_TERMS.maxActiveTrips,
      credits: TRIAL_TERMS.credits,
      periodStart: signedUpAt,
      periodEnd: trialEndsAt,
      ...paidFacts,
    };
  }
  // Free for good: the monthly credits count from the end of the free week.
  const window = monthlyWindow(trialEndsAt, now);
  return {
    access: 'free',
    trialEndsAt,
    maxActiveTrips: FREE_TERMS.maxActiveTrips,
    credits: FREE_TERMS.credits,
    periodStart: window.start,
    periodEnd: window.end,
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

/** Monthly credits go first; bought credits only once those are spent. */
export function creditBalance(input: {
  readonly entitlements: Entitlements;
  readonly usedInPeriod: number;
  readonly topUpBalance: number;
}): CreditBalance {
  const { entitlements: rights, usedInPeriod, topUpBalance } = input;
  const monthlyLeft = Math.max(0, rights.credits - usedInPeriod);
  const topUpLeft = Math.max(0, topUpBalance);
  const next = monthlyLeft > 0 ? 'monthly' : topUpLeft > 0 ? 'top-up' : null;
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

/**
 * Trips that count towards the plan's limit: active ones without a pass. More of them than the plan keeps (after
 * the free week, or when a plan lapses) means changes wait until some are archived, passed or a plan is chosen.
 */
export function countedTrips(
  activeTripIds: readonly string[],
  passed: ReadonlySet<string>,
): number {
  return activeTripIds.filter((id) => !passed.has(id)).length;
}

/** Whether the account holds more counted trips than its plan keeps. */
export function overTripLimit(rights: Entitlements, counted: number): boolean {
  return rights.maxActiveTrips !== null && counted > rights.maxActiveTrips;
}

export interface TripRights {
  /** A pass or a paid plan: the paid tools (offline, any number of people) on this trip. */
  readonly paid: boolean;
  /** People who may join besides the owner; null for no limit. */
  readonly guests: number | null;
}

/** What one trip allows: a paid plan or the trip's own pass opens everything; the free plan keeps one guest. */
export function tripEntitlements(
  rights: Entitlements,
  tripId: string,
  passed: ReadonlySet<string>,
): TripRights {
  const paid = rights.access === 'explorer' || rights.access === 'voyager' || passed.has(tripId);
  return { paid, guests: paid || rights.access === 'trial' ? null : FREE_TERMS.guests };
}
