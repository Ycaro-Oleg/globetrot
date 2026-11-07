import { messageShape, type MessageShape } from './ast';
import { flattenMessages, type MessageTree } from './catalog';

export type CatalogProblem =
  | { readonly kind: 'missing-key'; readonly locale: string; readonly key: string }
  | { readonly kind: 'extra-key'; readonly locale: string; readonly key: string }
  | {
      readonly kind: 'invalid-syntax';
      readonly locale: string;
      readonly key: string;
      readonly error: string;
    }
  | { readonly kind: 'empty-message'; readonly locale: string; readonly key: string }
  | {
      readonly kind: 'argument-mismatch';
      readonly locale: string;
      readonly key: string;
      readonly expected: readonly string[];
      readonly actual: readonly string[];
    };

const sorted = (set: ReadonlySet<string>) => [...set].sort();
const sameMembers = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

/**
 * Checks every locale against the source catalog: same keys, valid ICU syntax (plural/select need `other`),
 * non-empty messages, and the same placeholders and rich-text tags as the source.
 * Returns an empty list when all catalogs are consistent.
 */
export function validateCatalogs(
  sourceLocale: string,
  catalogs: Readonly<Record<string, MessageTree>>,
): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  const shapes = new Map<string, Map<string, MessageShape>>();

  for (const [locale, tree] of Object.entries(catalogs)) {
    const byKey = new Map<string, MessageShape>();
    for (const [key, message] of flattenMessages(tree)) {
      if (message.trim() === '') {
        problems.push({ kind: 'empty-message', locale, key });
        continue;
      }
      try {
        byKey.set(key, messageShape(message));
      } catch (error) {
        problems.push({ kind: 'invalid-syntax', locale, key, error: (error as Error).message });
      }
    }
    shapes.set(locale, byKey);
  }

  const sourceKeys = new Set(flattenMessages(catalogs[sourceLocale] ?? {}).map(([key]) => key));
  const source = shapes.get(sourceLocale) ?? new Map<string, MessageShape>();

  for (const [locale, tree] of Object.entries(catalogs)) {
    if (locale === sourceLocale) continue;
    const keys = new Set(flattenMessages(tree).map(([key]) => key));
    for (const key of sourceKeys)
      if (!keys.has(key)) problems.push({ kind: 'missing-key', locale, key });
    for (const key of keys)
      if (!sourceKeys.has(key)) problems.push({ kind: 'extra-key', locale, key });

    for (const [key, shape] of shapes.get(locale) ?? []) {
      const expected = source.get(key);
      if (!expected) continue;
      const expectedNames = new Set([...expected.args, ...[...expected.tags].map((t) => `<${t}>`)]);
      const actualNames = new Set([...shape.args, ...[...shape.tags].map((t) => `<${t}>`)]);
      if (!sameMembers(expectedNames, actualNames)) {
        problems.push({
          kind: 'argument-mismatch',
          locale,
          key,
          expected: sorted(expectedNames),
          actual: sorted(actualNames),
        });
      }
    }
  }
  return problems;
}

/** One human-readable line per problem, for the CLI and test failures. */
export function describeProblem(problem: CatalogProblem): string {
  const where = `[${problem.locale}] ${problem.key}`;
  switch (problem.kind) {
    case 'missing-key':
      return `${where}: missing (present in the source catalog)`;
    case 'extra-key':
      return `${where}: not in the source catalog (remove it or add it to the source)`;
    case 'invalid-syntax':
      return `${where}: invalid ICU syntax: ${problem.error}`;
    case 'empty-message':
      return `${where}: empty message`;
    case 'argument-mismatch':
      return `${where}: placeholders/tags differ. Expected ${problem.expected.join(', ') || '(none)'}, got ${problem.actual.join(', ') || '(none)'}`;
  }
}
