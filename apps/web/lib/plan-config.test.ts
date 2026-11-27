import { describe, expect, it } from 'vitest';
import {
  featureValues,
  monthlyOfAnnual,
  planCards,
  topUpPrice,
  topUpSmallPrice,
  tripPassPrice,
} from './plan-config';

describe('plan cards', () => {
  it('shows the free plan and the two paid ones, with the approved prices in each currency', () => {
    const usd = planCards('USD');
    expect(usd.map((plan) => plan.id)).toEqual(['free', 'explorer', 'voyager']);
    expect(usd.map((plan) => [plan.monthlyMinor, plan.annualMinor, plan.credits])).toEqual([
      [0n, 0n, 5],
      [499n, 3999n, 100],
      [999n, 7999n, 400],
    ]);
    expect(planCards('BRL').map((plan) => [plan.monthlyMinor, plan.annualMinor])).toEqual([
      [0n, 0n],
      [1490n, 11900n],
      [2990n, 23900n],
    ]);
    expect(usd.filter((plan) => plan.highlighted)).toHaveLength(1);
    expect([tripPassPrice('USD'), tripPassPrice('BRL')]).toEqual([999n, 4900n]);
    expect([topUpSmallPrice('USD'), topUpSmallPrice('BRL')]).toEqual([99n, 490n]);
    expect([topUpPrice('USD'), topUpPrice('BRL')]).toEqual([299n, 1490n]);
  });

  it('turns a yearly price into a monthly one', () => {
    expect(monthlyOfAnnual(3999n)).toBe(333n);
  });
});

describe('feature numbers', () => {
  it('come from the domain terms, not the catalog', () => {
    expect(planCards('USD').map(featureValues)).toEqual([
      { credits: 5, trips: 1, days: 7 },
      { credits: 100, trips: 10, days: 7 },
      { credits: 400, trips: 0, days: 7 },
    ]);
  });
});
