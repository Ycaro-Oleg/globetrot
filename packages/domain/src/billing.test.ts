import { describe, expect, it } from 'vitest';
import {
  addMonthsUtc,
  countedTrips,
  creditBalance,
  entitlements,
  FREE_TERMS,
  monthlyWindow,
  overTripLimit,
  passedTripIds,
  PLAN_PRICES,
  PLAN_TERMS,
  priceCurrencyFor,
  tripEntitlements,
  tripPassValidUntil,
  subscriptionGrants,
  TRIAL_TERMS,
  trialDaysLeft,
  type SubscriptionState,
} from './billing';

const signedUpAt = new Date('2026-11-01T10:00:00.000Z');
const at = (iso: string) => new Date(iso);
const sub = (patch: Partial<SubscriptionState> = {}): SubscriptionState => ({
  plan: 'explorer',
  interval: 'month',
  status: 'active',
  startedAt: at('2026-11-05T00:00:00.000Z'),
  currentPeriodEnd: at('2026-12-05T00:00:00.000Z'),
  ...patch,
});

describe('addMonthsUtc and monthlyWindow', () => {
  it('clamps to the last day of shorter months', () => {
    expect(addMonthsUtc(at('2027-01-31T08:00:00Z'), 1).toISOString()).toBe(
      '2027-02-28T08:00:00.000Z',
    );
    expect(addMonthsUtc(at('2028-01-31T08:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T08:00:00.000Z',
    );
    expect(addMonthsUtc(at('2026-11-05T00:00:00Z'), 14).toISOString()).toBe(
      '2028-01-05T00:00:00.000Z',
    );
  });

  it('finds the monthly window around now, also for yearly plans', () => {
    const start = at('2026-11-05T00:00:00Z');
    expect(monthlyWindow(start, at('2026-11-20T00:00:00Z'))).toEqual({
      start,
      end: at('2026-12-05T00:00:00Z'),
    });
    expect(monthlyWindow(start, at('2027-03-04T23:59:00Z'))).toEqual({
      start: at('2027-02-05T00:00:00Z'),
      end: at('2027-03-05T00:00:00Z'),
    });
    expect(monthlyWindow(start, at('2027-03-05T00:00:00Z')).start).toEqual(
      at('2027-03-05T00:00:00Z'),
    );
  });
});

describe('entitlements', () => {
  it('gives a 7-day trial with 15 credits from sign-up, then the free plan for good', () => {
    const trial = entitlements({ signedUpAt, subscription: null, now: at('2026-11-03T00:00:00Z') });
    expect(trial).toMatchObject({
      access: 'trial',
      credits: TRIAL_TERMS.credits,
      maxActiveTrips: 10,
      trialEndsAt: at('2026-11-08T10:00:00.000Z'),
      periodStart: signedUpAt,
      plan: null,
    });
    const free = entitlements({ signedUpAt, subscription: null, now: at('2026-11-20T00:00:00Z') });
    expect(free).toMatchObject({
      access: 'free',
      credits: FREE_TERMS.credits,
      maxActiveTrips: 1,
      // Free credits renew each month from the end of the free week.
      periodStart: at('2026-11-08T10:00:00.000Z'),
      periodEnd: at('2026-12-08T10:00:00.000Z'),
    });
  });

  it('gives the plan’s credits and limits while paid, counted per month from the start', () => {
    const rights = entitlements({
      signedUpAt,
      subscription: sub({ plan: 'voyager' }),
      now: at('2026-11-20T00:00:00Z'),
    });
    expect(rights).toMatchObject({
      access: 'voyager',
      credits: PLAN_TERMS.voyager.credits,
      maxActiveTrips: null,
      periodStart: at('2026-11-05T00:00:00Z'),
      periodEnd: at('2026-12-05T00:00:00Z'),
      renewsAt: at('2026-12-05T00:00:00Z'),
    });
  });

  it('keeps a canceled plan until the paid period ends, and a failed renewal for 3 more days', () => {
    const canceled = sub({ status: 'canceled' });
    expect(subscriptionGrants(canceled, at('2026-12-04T23:00:00Z'))).toBe(true);
    expect(subscriptionGrants(canceled, at('2026-12-05T00:00:00Z'))).toBe(false);
    const late = sub({ status: 'past_due' });
    expect(subscriptionGrants(late, at('2026-12-07T23:00:00Z'))).toBe(true);
    expect(subscriptionGrants(late, at('2026-12-08T00:00:00Z'))).toBe(false);
    const lapsed = entitlements({
      signedUpAt,
      subscription: canceled,
      now: at('2027-01-01T00:00:00Z'),
    });
    expect(lapsed).toMatchObject({
      access: 'free',
      plan: 'explorer',
      renewsAt: null,
    });
  });
});

describe('creditBalance', () => {
  const trial = entitlements({ signedUpAt, subscription: null, now: at('2026-11-02T00:00:00Z') });

  it('spends monthly credits first, then bought ones, then none', () => {
    expect(creditBalance({ entitlements: trial, usedInPeriod: 3, topUpBalance: 0 })).toEqual({
      monthlyLeft: 12,
      topUpLeft: 0,
      total: 12,
      next: 'monthly',
    });
    expect(creditBalance({ entitlements: trial, usedInPeriod: 20, topUpBalance: 5 })).toMatchObject(
      {
        monthlyLeft: 0,
        total: 5,
        next: 'top-up',
      },
    );
    expect(
      creditBalance({ entitlements: trial, usedInPeriod: 15, topUpBalance: 0 }).next,
    ).toBeNull();
  });

  it('lets a free account spend its monthly credits, then bought ones', () => {
    const free = entitlements({ signedUpAt, subscription: null, now: at('2026-12-01T00:00:00Z') });
    expect(creditBalance({ entitlements: free, usedInPeriod: 5, topUpBalance: 50 })).toMatchObject({
      monthlyLeft: 0,
      topUpLeft: 50,
      next: 'top-up',
    });
  });
});

it('counts trial days left, a started day as one', () => {
  const ends = at('2026-11-08T10:00:00Z');
  expect(trialDaysLeft(ends, at('2026-11-01T10:00:00Z'))).toBe(7);
  expect(trialDaysLeft(ends, at('2026-11-08T09:00:00Z'))).toBe(1);
  expect(trialDaysLeft(ends, at('2026-11-09T00:00:00Z'))).toBe(0);
});

describe('prices, the free plan and trip passes (ADR-0023)', () => {
  it('shows reais only to someone who chose reais, never from language or country', () => {
    expect(priceCurrencyFor('BRL')).toBe('BRL');
    expect(priceCurrencyFor('USD')).toBe('USD');
    expect(priceCurrencyFor('EUR')).toBe('USD');
    expect(priceCurrencyFor(null)).toBe('USD');
    expect(PLAN_PRICES.explorer.BRL).toEqual({ monthlyMinor: 1490n, annualMinor: 11900n });
    expect(PLAN_TERMS.explorer.monthlyMinor).toBe(PLAN_PRICES.explorer.USD.monthlyMinor);
  });

  it('lasts a pass 30 days past the trip, or 12 months without dates, and never less than 30 days', () => {
    const bought = at('2027-01-10T12:00:00Z');
    expect(tripPassValidUntil(bought, at('2027-03-20T00:00:00Z'))).toEqual(
      at('2027-04-20T00:00:00Z'),
    );
    expect(tripPassValidUntil(bought, null)).toEqual(at('2028-01-10T12:00:00Z'));
    expect(tripPassValidUntil(bought, at('2026-12-01T00:00:00Z'))).toEqual(
      at('2027-02-09T12:00:00Z'),
    );
  });

  it('leaves passed trips out of the limit and opens the paid tools on them', () => {
    const now = at('2027-02-01T00:00:00Z');
    const passed = passedTripIds(
      [
        { tripId: 'japan', validUntil: at('2027-05-01T00:00:00Z') },
        { tripId: 'old', validUntil: at('2027-01-01T00:00:00Z') },
      ],
      now,
    );
    expect([...passed]).toEqual(['japan']);
    const free = entitlements({ signedUpAt, subscription: null, now });
    expect(countedTrips(['japan', 'lisbon'], passed)).toBe(1);
    expect(overTripLimit(free, 1)).toBe(false);
    expect(overTripLimit(free, 2)).toBe(true);
    expect(tripEntitlements(free, 'japan', passed)).toEqual({ paid: true, guests: null });
    expect(tripEntitlements(free, 'lisbon', passed)).toEqual({
      paid: false,
      guests: FREE_TERMS.guests,
    });
    const paid = entitlements({
      signedUpAt,
      subscription: sub({ status: 'active', currentPeriodEnd: at('2027-03-01T00:00:00Z') }),
      now,
    });
    expect(tripEntitlements(paid, 'lisbon', passed).paid).toBe(true);
    expect(overTripLimit(paid, 9)).toBe(false);
  });
});
