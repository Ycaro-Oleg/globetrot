import { isSupportedLocale } from '@globetrot/i18n';
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, localeCookieOptions } from './i18n/locale';
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
 * 3. A link may name its language (`/?lang=pt-BR`, for ads and posts aimed at one language). That is the
 *    visitor's explicit choice, so it is stored like a click on the language switch, and this very page already
 *    renders in it. Unsupported values are ignored.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const linked = request.nextUrl.searchParams.get('lang');
  if (!isAppPath(pathname) && !isApiPath(pathname)) {
    if (!isSupportedLocale(linked)) return NextResponse.next();
    request.cookies.set(LOCALE_COOKIE, linked);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set(LOCALE_COOKIE, linked, localeCookieOptions());
    return response;
  }

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

const isApiPath = (pathname: string) =>
  pathname.startsWith('/api/auth/') || pathname === '/v1' || pathname.startsWith('/v1/');

// Constants only: Next analyses the matcher at build time. The public entry pages are listed for `?lang=`.
export const config = {
  matcher: ['/api/auth/:path*', '/v1/:path*', '/app/:path*', '/', '/signup', '/login', '/t/:path*'],
};
