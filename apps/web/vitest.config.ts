import { defineConfig } from 'vitest/config';

// The app's tsconfig keeps JSX as `preserve` for Next.js; tests need it compiled.
// Vite 8 transforms with oxc, so the JSX runtime is configured there.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'node' },
});
