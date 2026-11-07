import { NextResponse, type NextRequest } from 'next/server';
import { apiInternalUrl, apiProxyTarget } from './lib/api-proxy';

/**
 * The browser only ever talks to the web origin. Auth and `/v1` requests are forwarded to the API, so the
 * session cookie the API sets is a first-party cookie of the web app (no CORS, no third-party cookie
 * rules). The destination is read **per request**, not at build time, so one image works in every
 * environment. Details and the trust assumptions: docs/architecture/authentication.md.
 */
export function proxy(request: NextRequest) {
  const target = apiProxyTarget(request.nextUrl.pathname, request.nextUrl.search, apiInternalUrl());
  if (target === null) return new NextResponse(null, { status: 404 });
  return NextResponse.rewrite(target);
}

// Constants only: Next analyses the matcher at build time.
export const config = { matcher: ['/api/auth/:path*', '/v1/:path*'] };
