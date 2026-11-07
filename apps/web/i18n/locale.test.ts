import { describe, expect, it } from 'vitest';
import { catalogs } from '@globetrot/i18n';
import { resolveWebLocale } from './locale';

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
