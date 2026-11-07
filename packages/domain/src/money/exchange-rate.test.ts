import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { minorUnitExponent } from './currency';
import { CurrencyMismatchError, InvalidRateError, UnknownCurrencyError } from './errors';
import { convert, exchangeRate, type ExchangeRateInput } from './exchange-rate';
import { compare, fromDecimal, money, toDecimalString } from './money';

const asOf = new Date('2026-11-06T16:00:00Z');
const base: ExchangeRateInput = {
  id: 'fx_1',
  base: 'USD',
  quote: 'JPY',
  rate: '151.20',
  source: 'ECB',
  asOf,
};

describe('exchangeRate', () => {
  it('validates and freezes a rate record', () => {
    const rate = exchangeRate(base);
    expect(Object.isFrozen(rate)).toBe(true);
    expect(rate.asOf).not.toBe(asOf); // defensive copy
    expect(rate.asOf.getTime()).toBe(asOf.getTime());
  });

  it.each([
    [{ base: 'usd' }, UnknownCurrencyError],
    [{ quote: 'XYZ' }, UnknownCurrencyError],
    [{ quote: 'USD' }, InvalidRateError],
    [{ rate: '0' }, InvalidRateError],
    [{ rate: '-1.2' }, InvalidRateError],
    [{ rate: '1e3' }, InvalidRateError],
    [{ rate: '' }, InvalidRateError],
    [{ source: '  ' }, InvalidRateError],
    [{ asOf: new Date('invalid') }, InvalidRateError],
  ])('rejects %j', (override, error) => {
    expect(() => exchangeRate({ ...base, ...override })).toThrow(error);
  });
});

describe('convert', () => {
  const usdJpy = exchangeRate(base);

  it('converts base → quote across different exponents', () => {
    const result = convert(fromDecimal('12.50', 'USD'), usdJpy);
    expect(result.converted).toEqual(fromDecimal('1890', 'JPY')); // 12.5 × 151.2 = 1890
    expect(result.rateId).toBe('fx_1');
    expect(result.inverted).toBe(false);
    expect(result.original).toEqual(fromDecimal('12.50', 'USD'));
  });

  it('converts quote → base by applying the rate inversely', () => {
    const result = convert(fromDecimal('3000', 'JPY'), usdJpy);
    expect(toDecimalString(result.converted)).toBe('19.84'); // 3000 / 151.2 = 19.8412…
    expect(result.converted.currency).toBe('USD');
    expect(result.inverted).toBe(true);
  });

  it('rounds half-even once, at the end', () => {
    const eurUsd = exchangeRate({ ...base, base: 'EUR', quote: 'USD', rate: '1.5' });
    expect(convert(money(1n, 'EUR'), eurUsd).converted.amountMinor).toBe(2n); // 1.5 → 2
    expect(convert(money(3n, 'EUR'), eurUsd).converted.amountMinor).toBe(4n); // 4.5 → 4
    expect(convert(money(-3n, 'EUR'), eurUsd).converted.amountMinor).toBe(-4n);
  });

  it('handles three-decimal currencies', () => {
    const kwdUsd = exchangeRate({ ...base, base: 'KWD', quote: 'USD', rate: '3.2541' });
    expect(toDecimalString(convert(fromDecimal('1.000', 'KWD'), kwdUsd).converted)).toBe('3.25');
    expect(toDecimalString(convert(fromDecimal('10.00', 'USD'), kwdUsd).converted)).toBe('3.073');
  });

  it('refuses amounts in a currency the rate does not cover', () => {
    expect(() => convert(fromDecimal('1', 'EUR'), usdJpy)).toThrow(CurrencyMismatchError);
  });

  const rateArb = fc
    .tuple(fc.bigInt({ min: 1n, max: 10n ** 9n }), fc.integer({ min: 0, max: 8 }))
    .map(([digits, scale]) => ({ digits, scale }));

  it('base → quote is the nearest minor unit to the exact value', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 14n), max: 10n ** 14n }), rateArb, (amount, r) => {
        const rate = exchangeRate({
          ...base,
          base: 'USD',
          quote: 'KWD',
          rate: toPlain(r.digits, r.scale),
        });
        const out = convert(money(amount, 'USD'), rate).converted.amountMinor;
        // exact value in KWD minor units = amount × digits × 10^3 / (10^scale × 10^2)
        const numerator = amount * r.digits * 10n ** BigInt(minorUnitExponent(rate.quote));
        const denominator = 10n ** BigInt(r.scale + minorUnitExponent(rate.base));
        const error = numerator - out * denominator;
        expect(2n * (error < 0n ? -error : error) <= denominator).toBe(true);
      }),
    );
  });

  it('is monotonic in both directions', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        rateArb,
        (x, y, r) => {
          const rate = exchangeRate({ ...base, rate: toPlain(r.digits, r.scale) });
          const [lo, hi] = x <= y ? [x, y] : [y, x];
          const forward = [lo, hi].map((v) => convert(money(v, 'USD'), rate).converted);
          const backward = [lo, hi].map((v) => convert(money(v, 'JPY'), rate).converted);
          expect(compare(forward[0]!, forward[1]!)).toBeLessThanOrEqual(0);
          expect(compare(backward[0]!, backward[1]!)).toBeLessThanOrEqual(0);
        },
      ),
    );
  });
});

/** Builds a plain decimal string from digits × 10^−scale without floating point. */
function toPlain(digits: bigint, scale: number): string {
  if (scale === 0) return digits.toString();
  const padded = digits.toString().padStart(scale + 1, '0');
  return `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}
