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
  // CommonJS dependencies (pg) call `require('events')` and similar. In an ES-module bundle that has no
  // `require`, so give them a real one. Without this the bundle crashes at startup: "Dynamic require of
  // "events" is not supported". Only the built artifact shows it, never the tests.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  clean: true,
  sourcemap: true,
});
