/** Where the API listens by default (its own default port). Override with `API_INTERNAL_URL`. */
export const DEFAULT_API_URL = 'http://localhost:4000';

const AUTH_PREFIX = '/api/auth';

/**
 * The URL on the API that a browser request to the web app maps to, or `null` when the request must
 * not be forwarded. Only `/api/auth` and below is ever forwarded, so this can never become an open proxy:
 * dot segments (also percent-encoded) are resolved first and the result must still be under the prefix.
 * The host always comes from `apiBaseUrl`, never from the request.
 */
export function apiProxyTarget(pathname: string, search: string, apiBaseUrl: string): URL | null {
  let base: URL;
  try {
    base = new URL(apiBaseUrl);
  } catch {
    throw new Error('API_INTERNAL_URL is not a valid URL');
  }

  // Resolving against the real base turns "/api/auth/../x" and "/api/auth/%2e%2e/x" into "/x".
  const target = new URL(pathname, base);
  if (target.origin !== base.origin) return null;
  if (target.pathname !== AUTH_PREFIX && !target.pathname.startsWith(`${AUTH_PREFIX}/`))
    return null;

  target.search = search;
  return target;
}
