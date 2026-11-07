import { describe, expect, it } from 'vitest';
import { isCountryCode, listCountryCodes } from './countries';

describe('country codes', () => {
  it('has the 249 officially assigned ISO 3166-1 alpha-2 codes, once each', () => {
    const codes = listCountryCodes();
    expect(codes).toHaveLength(249);
    expect(new Set(codes).size).toBe(249);
    expect(codes).toEqual([...codes].sort());
  });

  it('only holds codes the platform knows as regions (cross-check against ICU)', () => {
    const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    for (const code of listCountryCodes()) {
      expect(names.of(code), code).toBeTypeOf('string');
    }
  });

  it.each(['BR', 'US', 'JP', 'PT', 'AX', 'ZW'])('accepts %s', (code) => {
    expect(isCountryCode(code)).toBe(true);
  });

  it.each([
    'br',
    'Br',
    'XX',
    'ZZ',
    'XK', // Kosovo is not assigned an ISO code
    'UK', // the ISO code of the United Kingdom is GB
    'EU',
    '',
    'BRA',
    '076',
    ' BR',
    'BR ',
    null,
    undefined,
    42,
  ])('rejects %j', (value) => {
    expect(isCountryCode(value)).toBe(false);
  });
});
