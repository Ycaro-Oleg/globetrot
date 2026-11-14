import { describe, expect, it } from 'vitest';
import { monthlyOfAnnual, PLAN_CARDS } from './plan-config';

describe('plan cards', () => {
  it('shows the trial and the two plans, with the approved prices', () => {
    expect(PLAN_CARDS.map((plan) => plan.id)).toEqual(['trial', 'explorer', 'voyager']);
    expect(PLAN_CARDS.map((plan) => [plan.monthlyMinor, plan.annualMinor, plan.credits])).toEqual([
      [0n, 0n, 15],
      [499n, 3999n, 100],
      [999n, 7999n, 400],
    ]);
    expect(PLAN_CARDS.filter((plan) => plan.highlighted)).toHaveLength(1);
  });

  it('turns a yearly price into a monthly one', () => {
    expect(monthlyOfAnnual(3999n)).toBe(333n);
  });
});
