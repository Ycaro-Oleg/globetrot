import { describe, expect, it } from 'vitest';
import {
  categoryRows,
  mondayOfIsoWeek,
  niceCeil,
  moneyFigures,
  savingsSeries,
  statusRows,
  type BudgetMoney,
  type SavingsHistory,
} from './money-series';

const brl = (amount: string) => ({ amount, currency: 'BRL' });

const budget = (overrides: Partial<BudgetMoney['savings']> = {}): BudgetMoney => ({
  currency: 'BRL',
  total: brl('10000.00'),
  byCategory: [
    { category: 'flights', amount: brl('6000.00') },
    { category: 'stay', amount: brl('3000.00') },
    { category: 'food', amount: brl('1000.00') },
    { category: 'taxes', amount: brl('0.00') },
  ],
  byStatus: [
    { status: 'estimate', amount: brl('7000.00') },
    { status: 'paid', amount: brl('3000.00') },
  ],
  savings: {
    status: 'saving',
    saved: brl('2500.00'),
    monthly: brl('3000.00'),
    left: brl('7500.00'),
    progressBasisPoints: 2500,
    readyMonth: '2027-03',
    departure: '2027-06-01',
    monthlyNeeded: brl('1250.00'),
    onTime: true,
    ...overrides,
  },
});

const history: SavingsHistory = {
  currency: 'BRL',
  saved: brl('2500.00'),
  start: brl('1000.00'),
  weeks: [
    { week: '2026-W46', amount: brl('500.00'), saved: brl('1500.00') },
    { week: '2026-W48', amount: brl('1000.00'), saved: brl('2500.00') },
  ],
};

describe('mondayOfIsoWeek', () => {
  it('finds the Monday of a week, across a year boundary too', () => {
    expect(mondayOfIsoWeek('2026-W48')).toBe('2026-11-23');
    expect(mondayOfIsoWeek('2027-W01')).toBe('2027-01-04');
    expect(mondayOfIsoWeek('2026-W01')).toBe('2025-12-29');
    expect(() => mondayOfIsoWeek('2026-48')).toThrow(RangeError);
  });
});

describe('savingsSeries', () => {
  it('draws the real balance week by week, then the plan from today to the goal', () => {
    const { points, goal } = savingsSeries(history, budget(), '2026-11-27');
    expect(goal).toBe(10000);
    expect(points.slice(0, 4)).toEqual([
      { date: '2026-11-02', saved: 1000, plan: null },
      { date: '2026-11-09', saved: 1500, plan: null },
      { date: '2026-11-23', saved: 2500, plan: null },
      { date: '2026-11-27', saved: 2500, plan: 2500 },
    ]);
    // 2500 + 3000 a month: 5500, 8500, then capped at the goal.
    expect(points.slice(4)).toEqual([
      { date: '2026-12-27', saved: null, plan: 5500 },
      { date: '2027-01-27', saved: null, plan: 8500 },
      { date: '2027-02-27', saved: null, plan: 10000 },
    ]);
  });

  it('stops the plan at the departure, and draws only today without check-ins or a monthly amount', () => {
    const late = savingsSeries(history, budget({ departure: '2027-01-10' }), '2026-11-27');
    expect(late.points.at(-1)).toEqual({ date: '2026-12-27', saved: null, plan: 5500 });
    const bare = savingsSeries(
      { ...history, weeks: [] },
      budget({ monthly: brl('0.00') }),
      '2026-11-27',
    );
    expect(bare.points).toEqual([{ date: '2026-11-27', saved: 2500, plan: 2500 }]);
  });
});

describe('cost breakdowns', () => {
  it('lists the categories largest first without empty ones, with their share', () => {
    expect(categoryRows(budget())).toEqual([
      { category: 'flights', amount: 6000, share: 0.6 },
      { category: 'stay', amount: 3000, share: 0.3 },
      { category: 'food', amount: 1000, share: 0.1 },
    ]);
  });

  it('keeps the statuses in reading order, missing ones at zero', () => {
    expect(statusRows(budget()).map((row) => [row.status, row.amount])).toEqual([
      ['paid', 3000],
      ['confirmed', 0],
      ['estimate', 7000],
      ['unknown', 0],
    ]);
  });

  it('works out the headline figures', () => {
    expect(moneyFigures(budget())).toMatchObject({
      total: 10000,
      saved: 2500,
      left: 7500,
      share: 0.25,
      monthly: 3000,
      monthlyNeeded: 1250,
      readyMonth: '2027-03',
    });
  });
});

describe('niceCeil', () => {
  it('rounds an axis top up to a round number', () => {
    expect(niceCeil(21276)).toBe(25000);
    expect(niceCeil(19700)).toBe(20000);
    expect(niceCeil(3001)).toBe(5000);
    expect(niceCeil(1000)).toBe(1000);
    expect(niceCeil(0)).toBe(1);
  });
});
