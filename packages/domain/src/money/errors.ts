/** Base class for every money-related domain error, so callers can catch the whole family. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The code is not an active ISO 4217 currency supported by Globetrot. */
export class UnknownCurrencyError extends MoneyError {
  constructor(readonly code: string) {
    super(`Unknown or unsupported ISO 4217 currency code: "${code}"`);
  }
}

/** Two amounts in different currencies were combined without an explicit conversion. */
export class CurrencyMismatchError extends MoneyError {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`Currency mismatch: expected ${expected}, got ${actual}. Convert explicitly first.`);
  }
}

/** A decimal amount string is malformed or has more precision than the currency allows. */
export class InvalidAmountError extends MoneyError {}

/** An exchange rate, multiplier or allocation ratio is malformed or out of range. */
export class InvalidRateError extends MoneyError {}
