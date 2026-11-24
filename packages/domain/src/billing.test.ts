import { describe, expect, it } from 'vitest';
import {
  addMonthsUtc,
  creditBalance,
  entitlements,
  monthlyWindow,
  PLAN_TERMS,
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
  it('gives a 7-day trial with 15 credits from sign-up, then read-only', () => {
    const trial = entitlements({ signedUpAt, subscription: null, now: at('2026-11-03T00:00:00Z') });
    expect(trial).toMatchObject({
      access: 'trial',
      readOnly: false,
      credits: TRIAL_TERMS.credits,
      maxActiveTrips: 10,
      trialEndsAt: at('2026-11-08T10:00:00.000Z'),
      periodStart: signedUpAt,
      plan: null,
    });
    const over = entitlements({ signedUpAt, subscription: null, now: at('2026-11-08T10:00:00Z') });
    expect(over).toMatchObject({ access: 'expired', readOnly: true, credits: 0 });
  });

  it('gives the plan’s credits and limits while paid, counted per month from the start', () => {
    const rights = entitlements({
      signedUpAt,
      subscription: sub({ plan: 'voyager' }),
      now: at('2026-11-20T00:00:00Z'),
    });
    expect(rights).toMatchObject({
      access: 'voyager',
      readOnly: false,
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
      access: 'expired',
      readOnly: true,
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

  it('lets a read-only account spend nothing, even with bought credits', () => {
    const over = entitlements({ signedUpAt, subscription: null, now: at('2026-12-01T00:00:00Z') });
    expect(creditBalance({ entitlements: over, usedInPeriod: 0, topUpBalance: 50 })).toMatchObject({
      topUpLeft: 50,
      next: null,
    });
  });
});

it('counts trial days left, a started day as one', () => {
  const ends = at('2026-11-08T10:00:00Z');
  expect(trialDaysLeft(ends, at('2026-11-01T10:00:00Z'))).toBe(7);
  expect(trialDaysLeft(ends, at('2026-11-08T09:00:00Z'))).toBe(1);
  expect(trialDaysLeft(ends, at('2026-11-09T00:00:00Z'))).toBe(0);
});
