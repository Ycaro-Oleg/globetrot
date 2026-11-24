/**
 * CI check (runs as part of `pnpm lint`): fails when the message catalogs disagree.
 * Usage: pnpm --filter @globetrot/i18n check
 */
import { catalogs } from '../src/catalog';
import { DEFAULT_LOCALE } from '../src/locales';
import { describeProblem, validateCatalogs } from '../src/validate';

const problems = validateCatalogs(DEFAULT_LOCALE, catalogs);

if (problems.length > 0) {
  console.error(`✖ ${problems.length} message catalog problem(s):`);
  for (const problem of problems) console.error(`  - ${describeProblem(problem)}`);
  console.error(
    '\nEvery locale in packages/i18n/messages/ must match the source catalog (en). See docs/architecture/i18n.md.',
  );
  process.exit(1);
}

const count = Object.values(catalogs).length;
console.log(`✓ ${count} message catalogs are consistent (${Object.keys(catalogs).join(', ')}).`);
