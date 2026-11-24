import { fromDecimal, toLocalDate } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import { chartBars, livePlan, parseAmount } from './budget-plan';

const usd = (amount: string) => fromDecimal(amount, 'USD');
const today = toLocalDate('2026-11-13');

describe('livePlan', () => {
  it('answers with the domain rule: ready month and on time against departure', () => {
    const plan = livePlan({
      total: usd('5000'),
      saved: usd('1450'),
      monthly: usd('900'),
      startDate: toLocalDate('2027-04-03'),
      today,
    });
    expect(plan.status).toBe('saving');
    expect(plan.monthsNeeded).toBe(4);
    expect(plan.readyMonth).toBe('2027-03');
    expect(plan.onTime).toBe(true);
  });

  it('says there is nothing to save for without costs', () => {
    const plan = livePlan({
      total: usd('0'),
      saved: usd('10'),
      monthly: usd('0'),
      startDate: null,
      today,
    });
    expect(plan.status).toBe('no-costs');
  });
});

describe('parseAmount', () => {
  it('reads plain amounts, with a dot or a comma for cents', () => {
    expect(parseAmount('1450', 'USD')?.amountMinor).toBe(145000n);
    expect(parseAmount(' 49,90 ', 'USD')?.amountMinor).toBe(4990n);
    expect(parseAmount('98000', 'JPY')?.amountMinor).toBe(98000n);
  });

  it('refuses what is not a plain non-negative amount', () => {
    for (const text of ['', 'lots', '-5', '1.450,50', '10.999']) {
      expect(parseAmount(text, 'USD')).toBeNull();
    }
  });
});

describe('chartBars', () => {
  it('projects six months and marks the first one that reaches the goal', () => {
    const bars = chartBars({
      total: usd('3000'),
      saved: usd('1000'),
      monthly: usd('800'),
      today,
      startDate: null,
    });
    expect(bars).toHaveLength(6);
    expect(bars.map((bar) => bar.month)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
    ]);
    expect(bars.findIndex((bar) => bar.ready)).toBe(3);
    expect(bars.filter((bar) => bar.ready)).toHaveLength(1);
    expect(bars[0]?.now).toBe(true);
  });

  it('stops at the departure month and marks it', () => {
    const bars = chartBars({
      total: usd('3000'),
      saved: usd('0'),
      monthly: usd('500'),
      today,
      startDate: toLocalDate('2027-01-20'),
    });
    expect(bars.map((bar) => bar.month)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(bars.at(-1)?.departure).toBe(true);
  });
});
