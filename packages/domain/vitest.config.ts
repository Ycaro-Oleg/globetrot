import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__fixtures__/**', 'src/index.ts', 'src/**/index.ts'],
      reporter: ['text-summary'],
      // Domain rules must stay at ≥ 95% coverage (issues #13, #14).
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
