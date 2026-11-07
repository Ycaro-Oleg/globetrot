import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument, OPENAPI_FILE, renderOpenApiDocument } from './openapi';

describe('OpenAPI contract', () => {
  it('is committed up to date (run `pnpm api:generate` after changing a route or schema)', () => {
    expect(readFileSync(OPENAPI_FILE, 'utf8')).toBe(renderOpenApiDocument());
  });

  it('describes /v1/me with the cookie scheme and problem+json errors', () => {
    const document = buildOpenApiDocument();
    expect(document.openapi).toBe('3.1.0');
    const operation = document.paths?.['/v1/me']?.get;
    expect(operation?.operationId).toBe('getCurrentUser');
    expect(operation?.security).toEqual([{ cookieAuth: [] }]);
    expect(Object.keys(operation?.responses ?? {})).toEqual(['200', '401', '404']);
    expect(document.components?.securitySchemes).toHaveProperty('cookieAuth');
  });

  it('keeps every operation under /v1 (the versioned surface)', () => {
    const paths = Object.keys(buildOpenApiDocument().paths ?? {});
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path.startsWith('/v1/')).toBe(true);
  });
});
