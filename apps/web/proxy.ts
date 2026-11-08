import { NextResponse, type NextRequest } from 'next/server';
import { apiInternalUrl, apiProxyTarget } from './lib/api-proxy';
import { isAppPath, isFlagGatedOff, loginRedirect } from './lib/app-gate';
import { isPipEnabled } from './lib/flags';
import { sessionCookieHeader } from './lib/stored-preferences';

/**
 * Two jobs, both before any page renders.
 *
 * 1. The browser only ever talks to the web origin. Auth and `/v1` requests are forwarded to the API, so the
 *    session cookie the API sets is a first-party cookie of the web app (no CORS, no third-party cookie
 *    rules). The destination is read **per request**, not at build time, so one image works in every
 *    environment. Details and the trust assumptions: docs/architecture/authentication.md.
 * 2. The signed-in app (`/app`) is for people with a session. A visitor without the session cookie goes to
 *    `/login?next=<page they wanted>`. Having the cookie proves nothing (it may be stale), so the app's layout
 *    asks the API too; this only saves rendering for anonymous visitors.
 *    Pages behind a feature flag that is off (`FEATURE_PIP`, see lib/flags.ts) are a 404 for everyone.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isAppPath(pathname)) {
    if (sessionCookieHeader(request.cookies.getAll()) === null) {
      // Built from the request's own URL (host included): Next rejects a relative Location in a proxy.
      const login = request.nextUrl.clone();
      const [loginPath = '/login', loginQuery = ''] = loginRedirect(pathname, search).split('?');
      login.pathname = loginPath;
      login.search = loginQuery ? `?${loginQuery}` : '';
      return NextResponse.redirect(login);
    }
    if (isFlagGatedOff(pathname, { pip: isPipEnabled() })) {
      // A page behind a feature flag that is off does not exist: answer exactly like an unknown address.
      const missing = request.nextUrl.clone();
      missing.pathname = '/feature-is-off';
      missing.search = '';
      return NextResponse.rewrite(missing);
    }
    return NextResponse.next();
  }

  const target = apiProxyTarget(pathname, search, apiInternalUrl());
  if (target === null) return new NextResponse(null, { status: 404 });
  return NextResponse.rewrite(target);
}

// Constants only: Next analyses the matcher at build time.
export const config = { matcher: ['/api/auth/:path*', '/v1/:path*', '/app/:path*'] };
