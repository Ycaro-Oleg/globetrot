import { PLAN_TERMS, TOP_UP, TRIAL_TERMS, type PaidPlan } from '@globetrot/domain';

/**
 * The plans as the pages show them (ADR-0019). Prices and credits come from the domain (`PLAN_TERMS`), never
 * from components; names, taglines and features are in the `plans` catalog. Amounts are USD minor units.
 */
export type PlanCardId = 'trial' | PaidPlan;

export interface PlanCard {
  readonly id: PlanCardId;
  readonly monthlyMinor: bigint;
  readonly annualMinor: bigint;
  readonly credits: number;
  /** Trips that are not archived; null for no limit. */
  readonly maxActiveTrips: number | null;
  readonly highlighted: boolean;
}

export const PLAN_CARDS: readonly PlanCard[] = [
  {
    id: 'trial',
    monthlyMinor: 0n,
    annualMinor: 0n,
    credits: TRIAL_TERMS.credits,
    maxActiveTrips: TRIAL_TERMS.maxActiveTrips,
    highlighted: false,
  },
  { id: 'explorer', ...PLAN_TERMS.explorer, highlighted: true },
  { id: 'voyager', ...PLAN_TERMS.voyager, highlighted: false },
];

export { TOP_UP };

/** A yearly price as a monthly one, rounded down to the cent. */
export const monthlyOfAnnual = (annualMinor: bigint) => annualMinor / 12n;

/** The numbers a plan's feature lines quote, so the catalog never repeats a limit the domain owns. */
export const featureValues = (plan: PlanCard) => ({
  credits: plan.credits,
  trips: plan.maxActiveTrips ?? 0,
});
