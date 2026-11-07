import { describe, expect, it } from 'vitest';
import { countryOptions, currencyOptions, NOT_SET, timeZoneOptions } from './options';

describe('settings options', () => {
  it('names countries in the user’s language, with the ISO code as the value', () => {
    const en = countryOptions('en');
    const pt = countryOptions('pt-BR');
    expect(en).toHaveLength(249);
    expect(en.find((option) => option.id === 'JP')?.label).toBe('Japan');
    expect(pt.find((option) => option.id === 'JP')?.label).toBe('Japão');
    expect(pt.find((option) => option.id === 'BR')?.label).toBe('Brasil');
  });

  it('sorts by the visible name in the user’s language', () => {
    const labels = countryOptions('pt-BR').map((option) => option.label);
    expect(labels).toEqual([...labels].sort(new Intl.Collator('pt-BR').compare));
  });

  it('lists every currency with its code, so USD and BRL are offered to everyone', () => {
    for (const locale of ['en', 'pt-BR']) {
      const options = currencyOptions(locale);
      const usd = options.find((option) => option.id === 'USD');
      const brl = options.find((option) => option.id === 'BRL');
      expect(usd?.label.startsWith('USD')).toBe(true);
      expect(brl?.label.startsWith('BRL')).toBe(true);
    }
    expect(currencyOptions('pt-BR').find((o) => o.id === 'USD')?.label).toContain('Dólar');
  });

  it('lists time zones, keeps a stored valid name that the platform list omits, and shows spaces', () => {
    const options = timeZoneOptions('en', 'America/Argentina/Buenos_Aires');
    expect(options.find((o) => o.id === 'America/Sao_Paulo')?.label).toBe('America/Sao Paulo');
    expect(options.some((o) => o.id === 'UTC')).toBe(true);
    expect(options.some((o) => o.id === 'America/Argentina/Buenos_Aires')).toBe(true);
    expect(timeZoneOptions('en', null).length).toBeGreaterThan(300);
  });

  it('uses an id for "not set" that no real value can have', () => {
    expect(NOT_SET).toBe('none');
    expect(countryOptions('en').some((o) => o.id === NOT_SET)).toBe(false);
    expect(timeZoneOptions('en', null).some((o) => o.id === NOT_SET)).toBe(false);
  });
});
