import { InvalidAmountError } from './errors';

/** An exact decimal: value = digits × 10^(−scale). */
export interface ScaledDecimal {
  readonly digits: bigint;
  readonly scale: number;
}

const DECIMAL_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

/** Parses a plain decimal string ("1234", "-0.50", "+3.141"). No exponents, separators or spaces. */
export function parseDecimal(input: string): ScaledDecimal {
  const match = DECIMAL_PATTERN.exec(input);
  if (!match) throw new InvalidAmountError(`Not a plain decimal number: "${input}"`);
  const [, sign, whole, fraction = ''] = match;
  const digits = BigInt(`${whole}${fraction}`);
  return { digits: sign === '-' ? -digits : digits, scale: fraction.length };
}

export function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/** Integer division rounding half to even ("banker's rounding"). `denominator` must be non-zero. */
export function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('Division by zero');
  if (denominator < 0n) return divideHalfEven(-numerator, -denominator);

  const quotient = numerator / denominator; // truncates toward zero
  const remainder = numerator % denominator; // same sign as numerator
  if (remainder === 0n) return quotient;

  const doubled = 2n * (remainder < 0n ? -remainder : remainder);
  const awayFromZero = numerator < 0n ? quotient - 1n : quotient + 1n;
  if (doubled > denominator) return awayFromZero;
  if (doubled < denominator) return quotient;
  return quotient % 2n === 0n ? quotient : awayFromZero;
}

/** Re-expresses `value` at `targetScale` digits, rounding half-even when precision is lost. */
export function rescaleHalfEven(value: ScaledDecimal, targetScale: number): bigint {
  if (value.scale <= targetScale) return value.digits * pow10(targetScale - value.scale);
  return divideHalfEven(value.digits, pow10(value.scale - targetScale));
}
