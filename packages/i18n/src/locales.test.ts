import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  negotiateLocale,
  parseAcceptLanguage,
  SUPPORTED_LOCALES,
} from './locales';

describe('supported locales', () => {
  it('ships English (source) and Brazilian Portuguese', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'pt-BR']);
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('recognises supported tags exactly', () => {
    expect(isSupportedLocale('pt-BR')).toBe(true);
    expect(isSupportedLocale('pt')).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe('negotiateLocale', () => {
  it.each<[string[], string]>([
    [['pt-BR'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    [['pt'], 'pt-BR'],
    [['en-GB'], 'en'],
    [['EN-us'], 'en'],
    [['fr-FR', 'pt'], 'pt-BR'],
    [['fr', 'de'], 'en'],
    [['not a tag!!', 'pt-BR'], 'pt-BR'],
    [[], 'en'],
  ])('%j → %s', (preferred, expected) => {
    expect(negotiateLocale(preferred)).toBe(expected);
  });
});

describe('parseAcceptLanguage', () => {
  it('orders tags by quality, keeping header order for ties', () => {
    expect(parseAcceptLanguage('en;q=0.8, pt-BR, pt;q=0.9, es;q=0.8')).toEqual([
      'pt-BR',
      'pt',
      'en',
      'es',
    ]);
  });

  it('drops wildcards, q=0 and malformed qualities', () => {
    expect(parseAcceptLanguage('*, fr;q=0, de;q=abc, it')).toEqual(['it']);
  });

  it('handles missing headers', () => {
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });

  it('feeds negotiation', () => {
    expect(negotiateLocale(parseAcceptLanguage('fr-CA,fr;q=0.9,pt;q=0.5'))).toBe('pt-BR');
  });
});
