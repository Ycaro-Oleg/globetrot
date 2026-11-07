/**
 * @globetrot/api-client: typed client for the `/v1` API, generated from its OpenAPI contract (ADR-0006).
 * Paths, parameters and responses are checked by the compiler; regenerate with `pnpm api:generate`.
 */
import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export const PACKAGE_NAME = '@globetrot/api-client' as const;

export type { components, operations, paths } from './generated/schema';

export interface ApiClientOptions {
  /**
   * Origin to call. In the browser use the web app's own origin (or leave it empty for relative URLs): it
   * proxies `/v1` to the API, which keeps the session cookie first-party. Server-side code must forward the
   * incoming `cookie` header itself.
   */
  readonly baseUrl: string;
  /** Replaces the global `fetch` (tests, or to add headers such as a forwarded `cookie`). */
  readonly fetch?: (request: Request) => Promise<Response>;
}

export function createApiClient(options: ApiClientOptions) {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
}
export type ApiClient = ReturnType<typeof createApiClient>;
