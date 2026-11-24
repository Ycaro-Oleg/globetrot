import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { divideHalfEven, parseDecimal, rescaleHalfEven } from './decimal';
import { InvalidAmountError } from './errors';

describe('parseDecimal', () => {
  it.each([
    ['0', 0n, 0],
    ['12', 12n, 0],
    ['12.50', 1250n, 2],
    ['-0.01', -1n, 2],
    ['+3.141', 3141n, 3],
    ['007.5', 75n, 1],
  ])('parses %s', (input, digits, scale) => {
    expect(parseDecimal(input)).toEqual({ digits, scale });
  });

  it.each(['', ' 1', '1 ', '1,5', '1e3', '.5', '5.', '--1', 'abc', 'NaN', 'Infinity', '1.2.3'])(
    'rejects %j',
    (input) => {
      expect(() => parseDecimal(input)).toThrow(InvalidAmountError);
    },
  );
});

describe('divideHalfEven', () => {
  it.each([
    [5n, 2n, 2n], // 2.5 → 2 (even)
    [7n, 2n, 4n], // 3.5 → 4 (even)
    [-5n, 2n, -2n],
    [-7n, 2n, -4n],
    [10n, 4n, 2n], // 2.5 → 2
    [11n, 4n, 3n], // 2.75 → 3
    [9n, 4n, 2n], // 2.25 → 2
    [-11n, 4n, -3n],
    [-9n, 4n, -2n],
    [6n, 3n, 2n], // exact
    [5n, -2n, -2n], // negative denominator
    [0n, 7n, 0n],
  ])('%d / %d → %d', (n, d, q) => {
    expect(divideHalfEven(n, d)).toBe(q);
  });

  it('rejects division by zero', () => {
    expect(() => divideHalfEven(1n, 0n)).toThrow(RangeError);
  });

  it('always returns the nearest integer, ties to even', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n }),
        fc.bigInt({ min: 1n, max: 10n ** 12n }),
        (n, d) => {
          const q = divideHalfEven(n, d);
          const error = n - q * d; // q·d is within d/2 of n
          const twiceAbsError = 2n * (error < 0n ? -error : error);
          expect(twiceAbsError <= d).toBe(true);
          if (twiceAbsError === d) expect(q % 2n).toBe(0n);
        },
      ),
    );
  });
});

describe('rescaleHalfEven', () => {
  it('scales up exactly', () => {
    expect(rescaleHalfEven({ digits: 125n, scale: 1 }, 3)).toBe(12500n);
  });

  it('scales down with half-even rounding', () => {
    expect(rescaleHalfEven({ digits: 12345n, scale: 3 }, 2)).toBe(1234n); // 12.345 → 12.34
    expect(rescaleHalfEven({ digits: 12355n, scale: 3 }, 2)).toBe(1236n); // 12.355 → 12.36
  });
});
