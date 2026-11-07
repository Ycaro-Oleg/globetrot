import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ES module without types: a build script shared with the CLI
import { renderSchema, SCHEMA_FILE } from '../scripts/generate-schema.mjs';

describe('generated client types', () => {
  it('are committed up to date (run `pnpm api:generate` after changing the API)', async () => {
    // `renderSchema` also parses and validates openapi.json, so an invalid document fails here too.
    const fresh = (await renderSchema()) as string;
    expect(readFileSync(SCHEMA_FILE as URL, 'utf8')).toBe(fresh);
  });
});
