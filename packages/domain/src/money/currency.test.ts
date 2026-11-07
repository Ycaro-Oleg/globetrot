import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  isCurrencyCode,
  listCurrencyCodes,
  minorUnitExponent,
  toCurrencyCode,
} from './currency';
import { UnknownCurrencyError } from './errors';

describe('currency registry', () => {
  it('defaults to USD (business rules: Locale and currency)', () => {
    expect(DEFAULT_CURRENCY).toBe('USD');
  });

  it.each([
    ['USD', 2],
    ['EUR', 2],
    ['BRL', 2],
    ['GBP', 2],
    ['JPY', 0],
    ['KRW', 0],
    ['CLP', 0],
    ['VND', 0],
    ['KWD', 3],
    ['BHD', 3],
    ['TND', 3],
  ])('%s has %d minor-unit digits', (code, exponent) => {
    expect(minorUnitExponent(toCurrencyCode(code))).toBe(exponent);
  });

  it('only contains well-formed codes with exponent 0, 2 or 3', () => {
    const codes = listCurrencyCodes();
    expect(codes.length).toBeGreaterThan(150);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect([0, 2, 3]).toContain(minorUnitExponent(code));
    }
  });

  it('lists codes sorted and without duplicates', () => {
    const codes = listCurrencyCodes();
    expect([...codes].sort()).toEqual(codes);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('excludes fund, metal, testing and withdrawn codes', () => {
    for (const code of [
      'XAU',
      'XDR',
      'XTS',
      'XXX',
      'USN',
      'CLF',
      'HRK',
      'SLL',
      'ZWL',
      'ANG',
      'BGN',
    ]) {
      expect(isCurrencyCode(code)).toBe(false);
    }
  });

  it('is case-sensitive and rejects non-strings', () => {
    expect(isCurrencyCode('usd')).toBe(false);
    expect(isCurrencyCode(840)).toBe(false);
    expect(isCurrencyCode(undefined)).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });

  it('throws a typed error for unknown codes', () => {
    expect(() => toCurrencyCode('ABC')).toThrow(UnknownCurrencyError);
    try {
      toCurrencyCode('ABC');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownCurrencyError);
      expect((error as UnknownCurrencyError).code).toBe('ABC');
      expect((error as Error).name).toBe('UnknownCurrencyError');
    }
  });
});
