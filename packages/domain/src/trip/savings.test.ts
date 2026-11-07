import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromDecimal, money, toDecimalString, zero } from '../money';
import { toLocalDate } from '../time';
import { JAPAN_TODAY, japanDemo } from './__fixtures__/japan-demo';
import { roundUpFriendly, savingsPlan } from './savings';
import type { TripPlan } from './types';

const brl = (s: string) => fromDecimal(s, 'BRL');
const withSavings = (saved: string, monthly: string, trip: TripPlan = japanDemo()): TripPlan => ({
  ...trip,
  savings: { saved: brl(saved), monthly: brl(monthly) },
});

describe('savingsPlan: Japan demo ("Almost. … by April 2027 — after you leave on 3 Apr.")', () => {
  const plan = savingsPlan(japanDemo(), JAPAN_TODAY);

  it('derives the answer sentence inputs', () => {
    expect(plan.status).toBe('saving');
    expect(toDecimalString(plan.total)).toBe('13700.00');
    expect(toDecimalString(plan.left)).toBe('7300.00');
    expect(plan.progressBasisPoints).toBe(4671); // 6,400 / 13,700 ≈ 46.7%
    expect(plan.monthsNeeded).toBe(5);
    expect(plan.readyMonth).toBe('2027-04');
    expect(plan.departure).toBe('2027-04-03');
    expect(plan.departed).toBe(false);
    expect(plan.monthsUntilDeparture).toBe(4);
    expect(plan.onTime).toBe(false);
  });

  it('suggests R$ 1,830 a month to be ready in time (prototype: R$ 1.830)', () => {
    expect(plan.monthlyNeeded).toEqual(brl('1830'));
  });

  it('says "Yes" when the pace is enough', () => {
    const fast = savingsPlan(withSavings('6400', '2000'), JAPAN_TODAY);
    expect(fast.monthsNeeded).toBe(4);
    expect(fast.readyMonth).toBe('2027-03');
    expect(fast.onTime).toBe(true);
  });
});

describe('savingsPlan: edge cases', () => {
  it('no costs yet', () => {
    const plan = savingsPlan({ ...japanDemo(), expenses: [] }, JAPAN_TODAY);
    expect(plan.status).toBe('no-costs');
    expect(plan.left).toEqual(zero('BRL'));
    expect(plan.progressBasisPoints).toBe(0);
    expect(plan.monthsNeeded).toBe(0);
    expect(plan.monthlyNeeded).toBeNull();
    expect(plan.onTime).toBe(true);
  });

  it('already fully saved (saving more than needed caps at 100%)', () => {
    const plan = savingsPlan(withSavings('20000', '1500'), JAPAN_TODAY);
    expect(plan.status).toBe('fully-saved');
    expect(plan.left).toEqual(zero('BRL'));
    expect(plan.progressBasisPoints).toBe(10_000);
    expect(plan.monthsNeeded).toBe(0);
    expect(plan.readyMonth).toBe('2026-11');
    expect(plan.monthlyNeeded).toBeNull();
    expect(plan.onTime).toBe(true);
  });

  it('monthly = 0', () => {
    const plan = savingsPlan(withSavings('6400', '0'), JAPAN_TODAY);
    expect(plan.monthsNeeded).toBeNull();
    expect(plan.readyMonth).toBeNull();
    expect(plan.onTime).toBe(false);
    expect(plan.monthlyNeeded).toEqual(brl('1830'));
  });

  it('nothing saved yet', () => {
    expect(savingsPlan(withSavings('0', '1500'), JAPAN_TODAY).progressBasisPoints).toBe(0);
  });

  it('no departure date', () => {
    const plan = savingsPlan({ ...japanDemo(), startDate: null }, JAPAN_TODAY);
    expect(plan.departure).toBeNull();
    expect(plan.departed).toBe(false);
    expect(plan.monthsUntilDeparture).toBeNull();
    expect(plan.monthlyNeeded).toBeNull();
    expect(plan.onTime).toBeNull();
    expect(plan.readyMonth).toBe('2027-04');
  });

  it('departure in the past', () => {
    const plan = savingsPlan(japanDemo(), toLocalDate('2027-05-01'));
    expect(plan.departed).toBe(true);
    expect(plan.monthsUntilDeparture).toBe(0);
    expect(plan.monthlyNeeded).toEqual(brl('7300'));
    expect(plan.onTime).toBe(false);
  });

  it('departure today counts as departed; less than a month away needs everything now', () => {
    expect(savingsPlan(japanDemo(), toLocalDate('2027-04-03')).departed).toBe(true);
    const soon = savingsPlan(japanDemo(), toLocalDate('2027-03-20'));
    expect(soon.departed).toBe(false);
    expect(soon.monthsUntilDeparture).toBe(0);
    expect(soon.monthlyNeeded).toEqual(brl('7300'));
  });
});

describe('roundUpFriendly', () => {
  it.each([
    ['1825.37', 'USD', '1830.00'],
    ['1830.00', 'USD', '1830.00'],
    ['36.20', 'USD', '37.00'],
    ['0.01', 'USD', '1.00'],
    ['182543', 'JPY', '183000'],
    ['7', 'JPY', '7'],
    ['12.345', 'KWD', '13.000'],
  ])('%s %s → %s', (input, currency, expected) => {
    expect(toDecimalString(roundUpFriendly(fromDecimal(input, currency)))).toBe(expected);
  });

  it('leaves zero and negatives alone', () => {
    expect(roundUpFriendly(zero('USD'))).toEqual(zero('USD'));
    expect(roundUpFriendly(money(-5n, 'USD'))).toEqual(money(-5n, 'USD'));
  });

  it('never rounds down and keeps three significant digits at most', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 15n }), (minor) => {
        const out = roundUpFriendly(money(minor, 'USD')).amountMinor;
        expect(out >= minor).toBe(true);
        expect(out % 100n).toBe(0n); // at least whole dollars
        expect(out.toString().replace(/0+$/, '').length).toBeLessThanOrEqual(3);
      }),
    );
  });
});

describe('savingsPlan properties', () => {
  const tripArb = fc
    .record({
      total: fc.bigInt({ min: 1n, max: 10n ** 9n }),
      saved: fc.bigInt({ min: 0n, max: 10n ** 9n }),
      monthly: fc.bigInt({ min: 0n, max: 10n ** 7n }),
      monthsAhead: fc.integer({ min: 1, max: 36 }),
    })
    .map(({ total, saved, monthly, monthsAhead }) => {
      const departure = toLocalDate(
        `${2027 + Math.floor((10 + monthsAhead) / 12)}-${String(((10 + monthsAhead) % 12) + 1).padStart(2, '0')}-15`,
      );
      const trip: TripPlan = {
        ...japanDemo(),
        startDate: departure,
        expenses: [
          {
            id: 'e',
            category: 'other',
            stopId: null,
            status: 'estimate',
            amount: money(total, 'BRL'),
          },
        ],
        savings: { saved: money(saved, 'BRL'), monthly: money(monthly, 'BRL') },
      };
      return trip;
    });

  it('saving the suggested monthly amount is always on time', () => {
    const today = toLocalDate('2027-11-01');
    fc.assert(
      fc.property(tripArb, (trip) => {
        const plan = savingsPlan(trip, today);
        fc.pre(
          plan.status === 'saving' &&
            plan.monthlyNeeded !== null &&
            (plan.monthsUntilDeparture ?? 0) > 0,
        );
        const followed = savingsPlan(
          { ...trip, savings: { ...trip.savings, monthly: plan.monthlyNeeded! } },
          today,
        );
        expect(followed.onTime).toBe(true);
      }),
    );
  });

  it('monthsNeeded is the smallest number of contributions that covers what is left', () => {
    fc.assert(
      fc.property(tripArb, (trip) => {
        const plan = savingsPlan(trip, toLocalDate('2027-11-01'));
        fc.pre(plan.status === 'saving' && plan.monthsNeeded !== null);
        const monthly = trip.savings.monthly.amountMinor;
        const n = BigInt(plan.monthsNeeded!);
        expect(n * monthly >= plan.left.amountMinor).toBe(true);
        expect((n - 1n) * monthly < plan.left.amountMinor).toBe(true);
      }),
    );
  });
});
