import { defineConfig } from 'vite';

export default defineConfig({
  // maplibre-gl v6 ships ESM with a separate module worker that imports a shared chunk.
  // main.ts imports it with `?worker&url`, so Vite bundles it as an ES-module worker and
  // hands the URL to maplibregl.setWorkerUrl(). Pre-bundling would break that relative import.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'es' },
});
