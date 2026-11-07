import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { listCurrencyCodes, minorUnitExponent } from './currency';
import {
  CurrencyMismatchError,
  InvalidAmountError,
  InvalidRateError,
  MoneyError,
  UnknownCurrencyError,
} from './errors';
import {
  add,
  allocate,
  compare,
  equals,
  fromDecimal,
  isNegative,
  isZero,
  money,
  multiply,
  negate,
  split,
  subtract,
  sum,
  toDecimalString,
  zero,
  type Money,
} from './money';

const codes = listCurrencyCodes();
const amountArb = fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n });
const moneyArb = fc.tuple(amountArb, fc.constantFrom(...codes)).map(([a, c]) => money(a, c));
const sameCurrencyPair = fc
  .tuple(amountArb, amountArb, fc.constantFrom(...codes))
  .map(([a, b, c]) => [money(a, c), money(b, c)] as const);

describe('construction', () => {
  it('validates the currency', () => {
    expect(() => money(1n, 'XYZ')).toThrow(UnknownCurrencyError);
  });

  it('creates immutable values', () => {
    const m = money(100n, 'USD');
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('creates zero', () => {
    expect(zero('JPY')).toEqual({ amountMinor: 0n, currency: 'JPY' });
  });
});

describe('fromDecimal / toDecimalString', () => {
  it.each([
    ['12.5', 'USD', 1250n, '12.50'],
    ['0.01', 'USD', 1n, '0.01'],
    ['-0.05', 'EUR', -5n, '-0.05'],
    ['1250', 'JPY', 1250n, '1250'],
    ['1.234', 'KWD', 1234n, '1.234'],
    ['0', 'BRL', 0n, '0.00'],
  ])('%s %s ↔ %d minor', (input, currency, minor, output) => {
    const m = fromDecimal(input, currency);
    expect(m.amountMinor).toBe(minor);
    expect(toDecimalString(m)).toBe(output);
  });

  it('rejects more precision than the currency has, by default', () => {
    expect(() => fromDecimal('12.345', 'USD')).toThrow(InvalidAmountError);
    expect(() => fromDecimal('1.5', 'JPY')).toThrow(InvalidAmountError);
  });

  it('rounds half-even when asked', () => {
    expect(fromDecimal('12.345', 'USD', { rounding: 'half-even' }).amountMinor).toBe(1234n);
    expect(fromDecimal('12.355', 'USD', { rounding: 'half-even' }).amountMinor).toBe(1236n);
    expect(fromDecimal('2.5', 'JPY', { rounding: 'half-even' }).amountMinor).toBe(2n);
  });

  it('rejects malformed input', () => {
    expect(() => fromDecimal('1,50', 'USD')).toThrow(InvalidAmountError);
    expect(() => fromDecimal('12.5', 'usd')).toThrow(UnknownCurrencyError);
  });

  it('round-trips any amount in any currency', () => {
    fc.assert(
      fc.property(moneyArb, (m) => {
        expect(fromDecimal(toDecimalString(m), m.currency)).toEqual(m);
      }),
    );
  });

  it('always prints the full minor-unit precision', () => {
    fc.assert(
      fc.property(moneyArb, (m) => {
        const fraction = toDecimalString(m).split('.')[1] ?? '';
        expect(fraction.length).toBe(minorUnitExponent(m.currency));
      }),
    );
  });
});

describe('arithmetic', () => {
  const usd = (s: string) => fromDecimal(s, 'USD');

  it('adds and subtracts in the same currency', () => {
    expect(add(usd('10.25'), usd('0.75'))).toEqual(usd('11.00'));
    expect(subtract(usd('10.25'), usd('0.75'))).toEqual(usd('9.50'));
    expect(negate(usd('3.10'))).toEqual(usd('-3.10'));
  });

  it('never mixes currencies silently', () => {
    const eur = fromDecimal('1', 'EUR');
    expect(() => add(usd('1'), eur)).toThrow(CurrencyMismatchError);
    expect(() => subtract(usd('1'), eur)).toThrow(CurrencyMismatchError);
    expect(() => compare(usd('1'), eur)).toThrow(CurrencyMismatchError);
    expect(() => sum([usd('1'), eur], 'USD')).toThrow(MoneyError);
  });

  it('sums lists, including empty ones', () => {
    expect(sum([usd('1.10'), usd('2.20'), usd('3.30')], 'USD')).toEqual(usd('6.60'));
    expect(sum([], 'BRL')).toEqual(zero('BRL'));
  });

  it('compares and tests values', () => {
    expect(compare(usd('1'), usd('2'))).toBe(-1);
    expect(compare(usd('2'), usd('1'))).toBe(1);
    expect(compare(usd('2'), usd('2.00'))).toBe(0);
    expect(equals(usd('2'), usd('2.00'))).toBe(true);
    expect(equals(usd('2'), fromDecimal('2', 'EUR'))).toBe(false);
    expect(isZero(usd('0'))).toBe(true);
    expect(isZero(usd('0.01'))).toBe(false);
    expect(isNegative(usd('-0.01'))).toBe(true);
    expect(isNegative(usd('0'))).toBe(false);
  });

  it('addition is commutative and subtraction inverts it', () => {
    fc.assert(
      fc.property(sameCurrencyPair, ([a, b]) => {
        expect(add(a, b)).toEqual(add(b, a));
        expect(subtract(add(a, b), b)).toEqual(a);
        // Antisymmetry. Sum instead of negation: -0 !== 0 under Object.is when a equals b.
        expect(compare(a, b) + compare(b, a)).toBe(0);
      }),
    );
  });

  it('compare is antisymmetric for equal values too (regression)', () => {
    const a = fromDecimal('7.00', 'USD');
    expect(compare(a, a)).toBe(0);
    expect(compare(a, a) + compare(a, a)).toBe(0);
  });

  it('addition is associative', () => {
    fc.assert(
      fc.property(amountArb, amountArb, amountArb, fc.constantFrom(...codes), (x, y, z, c) => {
        const [a, b, d] = [money(x, c), money(y, c), money(z, c)];
        expect(add(add(a, b), d)).toEqual(add(a, add(b, d)));
      }),
    );
  });
});

describe('multiply', () => {
  it('multiplies by integers exactly', () => {
    expect(multiply(fromDecimal('89.90', 'USD'), 4n)).toEqual(fromDecimal('359.60', 'USD'));
  });

  it('multiplies by decimal factors with half-even rounding', () => {
    expect(multiply(fromDecimal('10.00', 'USD'), '1.1')).toEqual(fromDecimal('11.00', 'USD'));
    expect(multiply(fromDecimal('0.05', 'USD'), '0.5').amountMinor).toBe(2n); // 2.5 → 2
    expect(multiply(fromDecimal('0.07', 'USD'), '0.5').amountMinor).toBe(4n); // 3.5 → 4
    expect(multiply(fromDecimal('100', 'JPY'), '-0.333').amountMinor).toBe(-33n);
  });

  it('rejects malformed factors', () => {
    expect(() => multiply(zero('USD'), '1e2')).toThrow(InvalidRateError);
  });
});

describe('allocate / split', () => {
  it('splits without losing a cent, extra cents first', () => {
    const parts = split(fromDecimal('100.00', 'USD'), 3).map(toDecimalString);
    expect(parts).toEqual(['33.34', '33.33', '33.33']);
  });

  it('allocates by ratio', () => {
    const parts = allocate(fromDecimal('0.05', 'USD'), [3, 7]).map((m) => m.amountMinor);
    expect(parts).toEqual([2n, 3n]); // 1.5 and 3.5 → remainders tie, earliest wins first
  });

  it('handles negative amounts and zero ratios', () => {
    const parts = allocate(fromDecimal('-10.00', 'EUR'), [1, 0, 1]).map(toDecimalString);
    expect(parts).toEqual(['-5.00', '0.00', '-5.00']);
  });

  it('rejects invalid ratios', () => {
    const m = fromDecimal('1', 'USD');
    expect(() => allocate(m, [])).toThrow(InvalidRateError);
    expect(() => allocate(m, [0, 0])).toThrow(InvalidRateError);
    expect(() => allocate(m, [1, -1])).toThrow(InvalidRateError);
    expect(() => allocate(m, [0.5])).toThrow(InvalidRateError);
    expect(() => split(m, 0)).toThrow(InvalidRateError);
    expect(() => split(m, 1.5)).toThrow(InvalidRateError);
  });

  it('parts always sum exactly to the original', () => {
    fc.assert(
      fc.property(
        moneyArb,
        fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 12 }),
        (m, ratios) => {
          fc.pre(ratios.some((r) => r > 0));
          const parts = allocate(m, ratios);
          expect(parts).toHaveLength(ratios.length);
          expect(sum(parts, m.currency)).toEqual(m);
          parts.forEach((p, i) => {
            if (ratios[i] === 0) expect(isZero(p)).toBe(true);
          });
        },
      ),
    );
  });

  it('equal splits differ by at most one minor unit', () => {
    fc.assert(
      fc.property(moneyArb, fc.integer({ min: 1, max: 50 }), (m, n) => {
        const amounts = split(m, n).map((p: Money) => p.amountMinor);
        const max = amounts.reduce((a, b) => (a > b ? a : b));
        const min = amounts.reduce((a, b) => (a < b ? a : b));
        expect(max - min <= 1n).toBe(true);
      }),
    );
  });
});
