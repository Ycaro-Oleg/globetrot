import { defineConfig } from 'drizzle-kit';

// `generate` and `check` work from the schema and the committed migrations only: no database needed.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
});
