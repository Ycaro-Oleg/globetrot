import { describe, expect, it } from 'vitest';
import { messageShape } from './ast';
import { catalogs, flattenMessages, lookupMessage, type MessageKey } from './catalog';
import { formatMessage } from './format';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locales';
import { describeProblem, validateCatalogs, type CatalogProblem } from './validate';

describe('shipped catalogs', () => {
  it('are consistent with the source catalog', () => {
    const problems = validateCatalogs(DEFAULT_LOCALE, catalogs);
    expect(problems.map(describeProblem)).toEqual([]);
  });

  it('format every message in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const [key, message] of flattenMessages(catalogs[locale])) {
        const values = Object.fromEntries([...messageShape(message).args].map((arg) => [arg, 2]));
        expect(formatMessage(locale, key as MessageKey, values).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('validateCatalogs', () => {
  const source = {
    a: 'Hello {name}',
    nested: { b: '{count, plural, one {# trip} other {# trips}}', c: '<b>Bold</b>' },
  };
  const check = (target: object) => validateCatalogs('en', { en: source, xx: target as never });

  it('accepts a matching catalog', () => {
    expect(
      check({
        a: 'Olá {name}',
        nested: { b: '{count, plural, one {# viagem} other {# viagens}}', c: '<b>Negrito</b>' },
      }),
    ).toEqual([]);
  });

  it('reports a key added to the source but not translated (the CI failure case)', () => {
    expect(check({ a: 'Olá {name}', nested: { c: '<b>Negrito</b>' } })).toEqual<CatalogProblem[]>([
      { kind: 'missing-key', locale: 'xx', key: 'nested.b' },
    ]);
  });

  it('reports keys that only exist in a translation', () => {
    const problems = check({ ...source, extra: 'Sobrando' });
    expect(problems).toEqual([{ kind: 'extra-key', locale: 'xx', key: 'extra' }]);
  });

  it('reports invalid ICU syntax, including plurals without `other`', () => {
    const problems = check({
      a: 'Olá {name',
      nested: { b: '{count, plural, one {# viagem}}', c: '<b>Negrito</b>' },
    });
    expect(problems.map((p) => [p.kind, p.key])).toEqual([
      ['invalid-syntax', 'a'],
      ['invalid-syntax', 'nested.b'],
    ]);
  });

  it('reports empty messages', () => {
    expect(check({ ...source, a: '  ' })).toEqual([
      { kind: 'empty-message', locale: 'xx', key: 'a' },
    ]);
  });

  it('reports renamed placeholders and missing tags', () => {
    const problems = check({ a: 'Olá {nome}', nested: { b: source.nested.b, c: 'Negrito' } });
    expect(problems).toEqual([
      { kind: 'argument-mismatch', locale: 'xx', key: 'a', expected: ['name'], actual: ['nome'] },
      { kind: 'argument-mismatch', locale: 'xx', key: 'nested.c', expected: ['<b>'], actual: [] },
    ]);
  });

  it('describes every problem kind in one line', () => {
    const lines = [
      { kind: 'missing-key', locale: 'xx', key: 'k' },
      { kind: 'extra-key', locale: 'xx', key: 'k' },
      { kind: 'invalid-syntax', locale: 'xx', key: 'k', error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
      { kind: 'empty-message', locale: 'xx', key: 'k' },
      { kind: 'argument-mismatch', locale: 'xx', key: 'k', expected: ['a'], actual: [] },
    ].map((p) => describeProblem(p as CatalogProblem));
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => l.startsWith('[xx] k: '))).toBe(true);
    expect(lines[4]).toContain('got (none)');
  });
});

describe('catalog helpers', () => {
  it('looks up leaves by dot path only', () => {
    expect(lookupMessage(catalogs.en, 'status.paid')).toBe('● paid');
    expect(lookupMessage(catalogs.en, 'status')).toBeUndefined();
    expect(lookupMessage(catalogs.en, 'status.paid.deeper')).toBeUndefined();
    expect(lookupMessage(catalogs.en, 'nope')).toBeUndefined();
    expect(lookupMessage(catalogs.en, 'toString')).toBeUndefined();
  });

  it('flattens in document order', () => {
    expect(flattenMessages({ x: 'X', y: { z: 'Z' } })).toEqual([
      ['x', 'X'],
      ['y.z', 'Z'],
    ]);
  });

  it('extracts placeholders and tags from nested messages', () => {
    const shape = messageShape(
      '<b>{n, plural, one {# {thing}} other {{n, number} {things}}}</b> on {d, date}',
    );
    expect([...shape.args].sort()).toEqual(['d', 'n', 'thing', 'things']);
    expect([...shape.tags]).toEqual(['b']);
  });
});
