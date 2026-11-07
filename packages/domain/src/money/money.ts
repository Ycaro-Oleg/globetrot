import { minorUnitExponent, toCurrencyCode, type CurrencyCode } from './currency';
import { parseDecimal, rescaleHalfEven } from './decimal';
import { CurrencyMismatchError, InvalidAmountError, InvalidRateError } from './errors';

/**
 * An exact amount of money: integer minor units + ISO 4217 currency (ADR-0004).
 * Never use floating point for stored or summed amounts.
 */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export interface FromDecimalOptions {
  /**
   * What to do when the input has more fractional digits than the currency allows.
   * `'reject'` (default) throws `InvalidAmountError`; `'half-even'` rounds.
   */
  readonly rounding?: 'reject' | 'half-even';
}

/** Creates Money from minor units, validating the currency code. */
export function money(amountMinor: bigint, currency: string): Money {
  return Object.freeze({ amountMinor, currency: toCurrencyCode(currency) });
}

export function zero(currency: string): Money {
  return money(0n, currency);
}

/** Parses a decimal string in major units: `fromDecimal('12.5', 'USD')` → 1250 minor units. */
export function fromDecimal(
  amount: string,
  currency: string,
  options: FromDecimalOptions = {},
): Money {
  const code = toCurrencyCode(currency);
  const exponent = minorUnitExponent(code);
  const parsed = parseDecimal(amount);
  if (parsed.scale > exponent && (options.rounding ?? 'reject') === 'reject') {
    throw new InvalidAmountError(
      `"${amount}" has more than ${exponent} fractional digit(s), the precision of ${code}`,
    );
  }
  return money(rescaleHalfEven(parsed, exponent), code);
}

/** Exact major-unit string with the currency's full precision: 1250 USD minor → "12.50". */
export function toDecimalString(value: Money): string {
  const exponent = minorUnitExponent(value.currency);
  const negative = value.amountMinor < 0n;
  const digits = (negative ? -value.amountMinor : value.amountMinor).toString();
  if (exponent === 0) return `${negative ? '-' : ''}${digits}`;
  const padded = digits.padStart(exponent + 1, '0');
  const whole = padded.slice(0, -exponent);
  const fraction = padded.slice(-exponent);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function negate(value: Money): Money {
  return money(-value.amountMinor, value.currency);
}

/** Sums amounts of one currency. The currency is required so an empty list still has one. */
export function sum(values: readonly Money[], currency: string): Money {
  return values.reduce(add, zero(currency));
}

/** −1, 0 or 1. Throws `CurrencyMismatchError` for different currencies. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor === b.amountMinor) return 0;
  return a.amountMinor < b.amountMinor ? -1 : 1;
}

/** Value equality (same currency and amount). Different currencies are simply not equal. */
export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0n;
}

export function isNegative(value: Money): boolean {
  return value.amountMinor < 0n;
}

/**
 * Multiplies by an exact factor (e.g. nights × nightly price, or "1.1" for +10%),
 * rounding half-even to the currency's minor unit. Accepts a bigint or a plain decimal string.
 */
export function multiply(value: Money, factor: bigint | string): Money {
  if (typeof factor === 'bigint') return money(value.amountMinor * factor, value.currency);
  let parsed;
  try {
    parsed = parseDecimal(factor);
  } catch {
    throw new InvalidRateError(`Not a plain decimal factor: "${factor}"`);
  }
  return money(
    rescaleHalfEven({ digits: value.amountMinor * parsed.digits, scale: parsed.scale }, 0),
    value.currency,
  );
}

/**
 * Splits an amount by integer ratios without losing a minor unit: the parts always sum
 * exactly to `value`. Leftover units go to the parts with the largest remainders, earliest first.
 * Example: allocate(USD 100.00, [1, 1, 1]) → [33.34, 33.33, 33.33].
 */
export function allocate(value: Money, ratios: readonly number[]): Money[] {
  if (ratios.length === 0) throw new InvalidRateError('allocate() needs at least one ratio');
  if (ratios.some((r) => !Number.isSafeInteger(r) || r < 0)) {
    throw new InvalidRateError('Allocation ratios must be non-negative safe integers');
  }
  const weights = ratios.map(BigInt);
  const total = weights.reduce((a, b) => a + b, 0n);
  if (total === 0n) throw new InvalidRateError('Allocation ratios must not all be zero');

  const negative = value.amountMinor < 0n;
  const amount = negative ? -value.amountMinor : value.amountMinor;
  const shares = weights.map((w) => (amount * w) / total);
  const remainders = weights.map((w, i) => ({ i, rem: (amount * w) % total }));
  let leftover = amount - shares.reduce((a, b) => a + b, 0n);

  remainders.sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  for (const { i } of remainders) {
    if (leftover === 0n) break;
    shares[i] = (shares[i] as bigint) + 1n;
    leftover -= 1n;
  }
  return shares.map((s) => money(negative ? -s : s, value.currency));
}

/** Splits into `parts` near-equal amounts that sum exactly to `value`. */
export function split(value: Money, parts: number): Money[] {
  if (!Number.isSafeInteger(parts) || parts < 1) {
    throw new InvalidRateError('split() needs a positive integer number of parts');
  }
  return allocate(
    value,
    Array.from({ length: parts }, () => 1),
  );
}
