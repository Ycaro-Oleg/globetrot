import { describe, expect, it } from 'vitest';
import { CurrencyMismatchError, fromDecimal, toDecimalString } from '../money';
import { japanDemo } from './__fixtures__/japan-demo';
import { tripTotals } from './totals';
import type { TripPlan } from './types';

const str = toDecimalString;

describe('tripTotals', () => {
  const totals = tripTotals(japanDemo());

  it('matches the prototype’s Japan board (R$ 13,700)', () => {
    expect(str(totals.total)).toBe('13700.00');
    expect(totals.total.currency).toBe('BRL');
  });

  it('splits by status like the stacked status bar', () => {
    expect(
      Object.fromEntries(Object.entries(totals.byStatus).map(([k, v]) => [k, str(v)])),
    ).toEqual({
      estimate: '12200.00',
      confirmed: '1120.00',
      paid: '380.00',
      unknown: '0.00',
    });
  });

  it('splits by category, listing unused categories as zero', () => {
    expect(str(totals.byCategory.flights)).toBe('6200.00');
    expect(str(totals.byCategory.stay)).toBe('2820.00');
    expect(str(totals.byCategory.local_transport)).toBe('1250.00');
    expect(str(totals.byCategory.taxes)).toBe('0.00');
    expect(Object.keys(totals.byCategory)).toHaveLength(12);
  });

  it('splits by stop and keeps whole-trip costs apart', () => {
    expect([...totals.byStop].map(([id, m]) => [id, str(m)])).toEqual([
      ['tokyo', '1180.00'],
      ['hakone', '520.00'],
      ['kyoto', '1120.00'],
    ]);
    expect(str(totals.tripWide)).toBe('10880.00');
  });

  it('is zero in the trip currency when there are no expenses', () => {
    const empty = tripTotals({ ...japanDemo(), expenses: [] });
    expect(empty.total).toEqual(fromDecimal('0', 'BRL'));
    expect(empty.byStop.size).toBe(0);
  });

  it('refuses expenses that were not converted to the trip currency', () => {
    const trip: TripPlan = {
      ...japanDemo(),
      expenses: [
        {
          id: 'x',
          category: 'food',
          stopId: null,
          status: 'estimate',
          amount: fromDecimal('10', 'USD'),
        },
      ],
    };
    expect(() => tripTotals(trip)).toThrow(CurrencyMismatchError);
  });
});
