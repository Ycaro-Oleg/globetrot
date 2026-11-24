import { describe, expect, it } from 'vitest';
import { catalogs, type MessageTree } from './catalog';
import { SUPPORTED_LOCALES } from './locales';

/** Every leaf of a catalog with its dot path. */
function* leaves(tree: MessageTree, prefix = ''): Generator<[string, string]> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') yield [path, value];
    else yield* leaves(value, path);
  }
}

describe.each(SUPPORTED_LOCALES)('the %s catalog', (locale) => {
  it('never writes a price: prices come from the pricing table (PLAN_TERMS) as arguments', () => {
    const quoted = [...leaves(catalogs[locale] as unknown as MessageTree)]
      .filter(([, text]) => /(US)?\$\s?\d|\d[.,]\d\d\s?(USD|US\$)/.test(text))
      .map(([path]) => path);
    expect(quoted).toEqual([]);
  });
});
