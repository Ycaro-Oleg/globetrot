import { safeNext } from './safe-next';

/** Whether a request path belongs to the signed-in app. */
export const isAppPath = (pathname: string) => pathname === '/app' || pathname.startsWith('/app/');

/**
 * Where an anonymous visitor to `pathname` is sent: the log-in page, remembering the page they wanted. The
 * remembered path goes through `safeNext`, so it can only ever be a path on this site.
 */
export function loginRedirect(pathname: string, search = ''): string {
  return `/login?next=${encodeURIComponent(safeNext(`${pathname}${search}`))}`;
}
