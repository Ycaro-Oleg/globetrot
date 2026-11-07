import { minorUnitExponent, toCurrencyCode, type CurrencyCode } from './currency';
import { divideHalfEven, parseDecimal, pow10, type ScaledDecimal } from './decimal';
import { CurrencyMismatchError, InvalidRateError } from './errors';
import { money, type Money } from './money';

/**
 * A recorded exchange rate with provenance: 1 `base` = `rate` `quote`.
 * The rate is a decimal string (stored as NUMERIC), never a float. See docs/architecture/money.md.
 */
export interface ExchangeRate {
  readonly id: string;
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  readonly rate: string;
  readonly source: string;
  readonly asOf: Date;
}

export interface ExchangeRateInput {
  readonly id: string;
  readonly base: string;
  readonly quote: string;
  readonly rate: string;
  readonly source: string;
  readonly asOf: Date;
}

/** The result of a conversion, carrying what is needed to show "converted at … · source · date". */
export interface Conversion {
  readonly original: Money;
  readonly converted: Money;
  readonly rateId: string;
  /** True when the amount was in the rate's quote currency and the rate was applied inversely. */
  readonly inverted: boolean;
}

function parsePositiveRate(rate: string): ScaledDecimal {
  let parsed: ScaledDecimal;
  try {
    parsed = parseDecimal(rate);
  } catch {
    throw new InvalidRateError(`Not a plain decimal rate: "${rate}"`);
  }
  if (parsed.digits <= 0n) throw new InvalidRateError(`Exchange rate must be positive: "${rate}"`);
  return parsed;
}

/** Validates and freezes an exchange rate record. */
export function exchangeRate(input: ExchangeRateInput): ExchangeRate {
  const base = toCurrencyCode(input.base);
  const quote = toCurrencyCode(input.quote);
  if (base === quote) throw new InvalidRateError(`Exchange rate base and quote are both ${base}`);
  parsePositiveRate(input.rate);
  if (Number.isNaN(input.asOf.getTime()))
    throw new InvalidRateError('Exchange rate asOf is not a valid date');
  if (input.source.trim() === '') throw new InvalidRateError('Exchange rate source is required');
  return Object.freeze({ ...input, base, quote, asOf: new Date(input.asOf.getTime()) });
}

/**
 * Converts an amount using a recorded rate, rounding half-even once, at the end (ADR-0004).
 * Works in both directions: an amount in `base` is multiplied, an amount in `quote` is divided.
 */
export function convert(value: Money, rate: ExchangeRate): Conversion {
  const r = parsePositiveRate(rate.rate);
  const eBase = minorUnitExponent(rate.base);
  const eQuote = minorUnitExponent(rate.quote);

  if (value.currency === rate.base) {
    // minorQuote = minorBase × rate × 10^eQuote / 10^eBase
    const amount = divideHalfEven(
      value.amountMinor * r.digits * pow10(eQuote),
      pow10(r.scale + eBase),
    );
    return {
      original: value,
      converted: money(amount, rate.quote),
      rateId: rate.id,
      inverted: false,
    };
  }
  if (value.currency === rate.quote) {
    // minorBase = minorQuote × 10^eBase / (rate × 10^eQuote)
    const amount = divideHalfEven(
      value.amountMinor * pow10(r.scale + eBase),
      r.digits * pow10(eQuote),
    );
    return {
      original: value,
      converted: money(amount, rate.base),
      rateId: rate.id,
      inverted: true,
    };
  }
  throw new CurrencyMismatchError(`${rate.base} or ${rate.quote}`, value.currency);
}
