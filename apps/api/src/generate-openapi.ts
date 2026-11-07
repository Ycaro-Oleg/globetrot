// Writes the OpenAPI document that `@globetrot/api-client` is generated from.
// Run with `pnpm api:generate` (root). A test fails when the committed file is stale.
import { writeFileSync } from 'node:fs';
import { OPENAPI_FILE, renderOpenApiDocument } from './openapi';

writeFileSync(OPENAPI_FILE, renderOpenApiDocument());
console.log(`wrote ${OPENAPI_FILE.pathname}`);
