import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/**/index.ts'],
      reporter: ['text-summary'],
      // Issue #13: the money module must stay at ≥ 95% coverage.
      thresholds: {
        'src/money/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
