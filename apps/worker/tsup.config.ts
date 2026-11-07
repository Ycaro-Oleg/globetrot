import { defineConfig } from 'tsup';

// Bundle everything (workspace packages and npm deps) so the runtime image only needs `dist/`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  noExternal: [/.*/],
  clean: true,
  sourcemap: true,
});
