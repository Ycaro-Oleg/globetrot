import { configDefaults, defineConfig } from 'vitest/config';

// `pnpm test` runs fast unit tests only; integration tests need Postgres (`pnpm test:int`).
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/*.int.test.ts'] },
});
