/** Where the API listens by default (its own default port). Override with `API_INTERNAL_URL`. */
export const DEFAULT_API_URL = 'http://localhost:4000';

/** The only parts of the API the browser may reach through the web origin: sign-in and the `/v1` operations. */
export const PROXIED_PREFIXES = ['/api/auth', '/v1'] as const;

const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * The URL on the API that a browser request to the web app maps to, or `null` when the request must
 * not be forwarded. Only the prefixes in `PROXIED_PREFIXES` and below are ever forwarded, so this can never
 * become an open proxy: dot segments (also percent-encoded) are resolved first and the result must still be
 * under one of them. The host always comes from `apiBaseUrl`, never from the request.
 */
export function apiProxyTarget(pathname: string, search: string, apiBaseUrl: string): URL | null {
  let base: URL;
  try {
    base = new URL(apiBaseUrl);
  } catch {
    throw new Error('API_INTERNAL_URL is not a valid URL');
  }

  // Resolving against the real base turns "/v1/../x" and "/v1/%2e%2e/x" into "/x".
  const target = new URL(pathname, base);
  if (target.origin !== base.origin) return null;
  if (!PROXIED_PREFIXES.some((prefix) => isUnder(target.pathname, prefix))) return null;

  target.search = search;
  return target;
}
