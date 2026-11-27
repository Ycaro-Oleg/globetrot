import {
  FREE_TERMS,
  PLAN_PRICES,
  PLAN_TERMS,
  TOP_UP,
  TOP_UP_PRICES,
  TRIAL_TERMS,
  TRIP_PASS,
  type PaidPlan,
  type PriceCurrency,
} from '@globetrot/domain';

/**
 * The plans as the pages show them (ADR-0019, ADR-0023). Prices, credits and limits come from the domain
 * (`PLAN_PRICES`, `PLAN_TERMS`, `FREE_TERMS`), never from components; names, taglines and features are in the
 * `plans` catalog. Amounts are minor units in the price currency.
 */
export type PlanCardId = 'free' | PaidPlan;

export interface PlanCard {
  readonly id: PlanCardId;
  readonly monthlyMinor: bigint;
  readonly annualMinor: bigint;
  readonly credits: number;
  /** Trips that are not archived; null for no limit. */
  readonly maxActiveTrips: number | null;
  readonly highlighted: boolean;
}

/** The free plan and the two paid ones, priced in `currency`. */
export function planCards(currency: PriceCurrency): readonly PlanCard[] {
  return [
    {
      id: 'free',
      monthlyMinor: 0n,
      annualMinor: 0n,
      credits: FREE_TERMS.credits,
      maxActiveTrips: FREE_TERMS.maxActiveTrips,
      highlighted: false,
    },
    {
      id: 'explorer',
      ...PLAN_TERMS.explorer,
      ...PLAN_PRICES.explorer[currency],
      highlighted: true,
    },
    { id: 'voyager', ...PLAN_TERMS.voyager, ...PLAN_PRICES.voyager[currency], highlighted: false },
  ];
}

export const topUpPrice = (currency: PriceCurrency) => TOP_UP_PRICES[currency];
export const tripPassPrice = (currency: PriceCurrency) => TRIP_PASS.prices[currency];

export { TOP_UP };

/** A yearly price as a monthly one, rounded down to the cent. */
export const monthlyOfAnnual = (annualMinor: bigint) => annualMinor / 12n;

/** The numbers a plan's feature lines quote, so the catalog never repeats a limit the domain owns. */
export const featureValues = (plan: PlanCard) => ({
  credits: plan.credits,
  trips: plan.maxActiveTrips ?? 0,
  days: TRIAL_TERMS.days,
});
