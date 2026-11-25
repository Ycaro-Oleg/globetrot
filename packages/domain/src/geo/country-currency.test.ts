import { describe, expect, it } from 'vitest';
import { currencyOfCountry } from './country-currency';

describe('currencyOfCountry', () => {
  it('suggests the currency of the destination country', () => {
    expect(currencyOfCountry('FR')).toBe('EUR');
    expect(currencyOfCountry('JP')).toBe('JPY');
    expect(currencyOfCountry('BR')).toBe('BRL');
    expect(currencyOfCountry('US')).toBe('USD');
    expect(currencyOfCountry('gb')).toBe('GBP');
  });

  it('knows nothing for an unknown or missing country', () => {
    expect(currencyOfCountry('ZZ')).toBeNull();
    expect(currencyOfCountry(null)).toBeNull();
    expect(currencyOfCountry('')).toBeNull();
  });
});
