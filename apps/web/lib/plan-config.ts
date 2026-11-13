/**
 * Mock plans for the landing page (docs/integrations/stripe.md, "Landing pricing"). Placeholder data until the owner
 * approves pricing (M10): nothing here is charged, and components read prices only from this module. Amounts are
 * minor units in USD, the default currency.
 */
export const PLAN_IDS = ['free', 'explorer', 'voyager'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanConfig {
  readonly id: PlanId;
  readonly monthlyMinor: bigint;
  /** A year paid at once: two months free. Placeholder like the rest. */
  readonly annualMinor: bigint;
  readonly currency: 'USD';
  /** Shown as the suggested plan. */
  readonly highlighted: boolean;
  /** Always true until pricing is approved: the page must say these are placeholders. */
  readonly placeholder: true;
}

export const MOCK_PLANS: readonly PlanConfig[] = [
  {
    id: 'free',
    monthlyMinor: 0n,
    annualMinor: 0n,
    currency: 'USD',
    highlighted: false,
    placeholder: true,
  },
  {
    id: 'explorer',
    monthlyMinor: 499n,
    annualMinor: 4990n,
    currency: 'USD',
    highlighted: true,
    placeholder: true,
  },
  {
    id: 'voyager',
    monthlyMinor: 999n,
    annualMinor: 9990n,
    currency: 'USD',
    highlighted: false,
    placeholder: true,
  },
];
