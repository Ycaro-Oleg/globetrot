import { defineConfig } from 'tsup';

// Bundle everything (workspace packages and npm deps) so the runtime image only needs `dist/`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  noExternal: [/.*/],
  // `pg` loads the optional native binding lazily and falls back to pure JS when it is absent.
  external: ['pg-native'],
  clean: true,
  sourcemap: true,
  // Bundled CommonJS dependencies (pg) call `require` for Node built-ins: give the ESM bundle one.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
