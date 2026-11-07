import { describe, expect, it } from 'vitest';
import { catalogs } from '@globetrot/i18n';
import { chooseLocale, resolveWebLocale } from './locale';

describe('web locale choice', () => {
  it('accepts the supported explicit choices', () => {
    expect(resolveWebLocale('en')).toBe('en');
    expect(resolveWebLocale('pt-BR')).toBe('pt-BR');
    expect(catalogs.en.webScaffold.headline).not.toBe(catalogs['pt-BR'].webScaffold.headline);
  });

  it('falls back for absent and unsupported choices without inferring currency', () => {
    expect(resolveWebLocale(undefined)).toBe('en');
    expect(resolveWebLocale('pt')).toBe('en');
  });
});

describe('chooseLocale', () => {
  it('uses the signed-in user’s stored language over the cookie', () => {
    expect(chooseLocale('en', { locale: 'pt-BR' })).toBe('pt-BR');
    expect(chooseLocale('pt-BR', { locale: 'en' })).toBe('en');
    expect(chooseLocale(undefined, { locale: 'pt-BR' })).toBe('pt-BR');
  });

  it('uses the cookie for an anonymous visitor, and when the stored language cannot be read', () => {
    expect(chooseLocale('pt-BR', null)).toBe('pt-BR');
    expect(chooseLocale('pt-BR', { locale: 'fr' })).toBe('pt-BR');
  });

  it('falls back to English when there is nothing usable', () => {
    expect(chooseLocale(undefined, null)).toBe('en');
    expect(chooseLocale('fr', null)).toBe('en');
    expect(chooseLocale('fr', { locale: 'de' })).toBe('en');
  });
});
