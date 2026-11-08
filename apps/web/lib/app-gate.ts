import { safeNext } from './safe-next';

/** Whether a request path belongs to the signed-in app. */
export const isAppPath = (pathname: string) => pathname === '/app' || pathname.startsWith('/app/');

/**
 * Whether `pathname` is an app page whose feature flag is off. Such a page must answer 404 like any page that does
 * not exist, so the proxy decides it before rendering: inside the app, the loading boundary has already sent a
 * 200 by the time a page could call `notFound()`.
 */
export function isFlagGatedOff(pathname: string, flags: { readonly pip: boolean }): boolean {
  return !flags.pip && (pathname === '/app/pip' || pathname.startsWith('/app/pip/'));
}

/**
 * Where an anonymous visitor to `pathname` is sent: the log-in page, remembering the page they wanted. The
 * remembered path goes through `safeNext`, so it can only ever be a path on this site.
 */
export function loginRedirect(pathname: string, search = ''): string {
  return `/login?next=${encodeURIComponent(safeNext(`${pathname}${search}`))}`;
}
