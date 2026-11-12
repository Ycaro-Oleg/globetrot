import { describe, expect, it } from 'vitest';
import { MOCK_PLANS, PLAN_IDS } from './plan-config';

describe('mock plans', () => {
  it('lists every plan once, in USD, all marked as placeholders, with exactly one free plan', () => {
    expect(MOCK_PLANS.map((plan) => plan.id)).toEqual([...PLAN_IDS]);
    expect(MOCK_PLANS.every((plan) => plan.currency === 'USD' && plan.placeholder)).toBe(true);
    expect(MOCK_PLANS.filter((plan) => plan.monthlyMinor === 0n)).toHaveLength(1);
    expect(MOCK_PLANS.filter((plan) => plan.highlighted)).toHaveLength(1);
  });
});
