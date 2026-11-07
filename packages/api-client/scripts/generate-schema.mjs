// Generates the TypeScript types of the API from the committed OpenAPI document.
//   pnpm api:generate   (root: regenerates openapi.json from the API, then this file)
// `contract.test.ts` imports `renderSchema` and fails when the committed output is stale, so CI catches it.
import { mkdirSync, writeFileSync } from 'node:fs';
import openapiTS, { astToString } from 'openapi-typescript';

export const OPENAPI_FILE = new URL('../openapi.json', import.meta.url);
export const SCHEMA_FILE = new URL('../src/generated/schema.ts', import.meta.url);

const HEADER = `/**
 * GENERATED from openapi.json by scripts/generate-schema.mjs. Do not edit by hand.
 * Regenerate with \`pnpm api:generate\` from the repository root.
 */

`;

/** Throws if the OpenAPI document is not valid, which is what makes this double as a validation step. */
export async function renderSchema() {
  const ast = await openapiTS(OPENAPI_FILE);
  return HEADER + astToString(ast);
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file:').href) {
  mkdirSync(new URL('./', SCHEMA_FILE), { recursive: true });
  writeFileSync(SCHEMA_FILE, await renderSchema());
  console.log(`wrote ${SCHEMA_FILE.pathname}`);
}
